const SPREADSHEET_ID = '17xXPyYG8yKHFv-CrN_Yziv9vqdcyaukZltuIoM1XED0'; // *** เปลี่ยนตรงนี้เป็น Spreadsheet ID ของคุณ ***
const SHEET_NAME = 'Sheet1'; // ชื่อ Sheet ของคุณ (ปกติคือ Sheet1)
const SECRET_PASSWORD = '12345'; // *** เปลี่ยนรหัสผ่านตรงนี้ ***
const GOOGLE_DRIVE_FOLDER_ID = '1cW8hceU2ee9TYcpcW3G5DJ3JTxc8pkjoQ_aWtP1U5v4'; 
// ฟังก์ชันสำหรับจัดการ POST Request (บันทึกข้อมูล)
function doPost(e) {
  if (e.parameter.action == 'postData') {
    const password = e.parameter.password;
    if (password !== SECRET_PASSWORD) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unauthorized' })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    // ตรวจสอบหรือสร้าง Header ถ้ายังไม่มี (สำคัญมากสำหรับการทำงานครั้งแรก)
    let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const expectedHeaders = ['ID', 'Type', 'ItemName', 'Description', 'Location', 'ContactInfo', 'DatePosted', 'ImageURL', 'Status'];
    
    if (headers.length === 0 || !expectedHeaders.every(h => headers.includes(h))) {
      sheet.clear(); // ล้างข้อมูลเก่าหาก Header ไม่ถูกต้อง
      sheet.appendRow(expectedHeaders);
      headers = expectedHeaders;
    }

    const newRow = [];

    // สร้าง ID อัตโนมัติ (เริ่มจาก 1 สำหรับแถวแรกของข้อมูล)
    const lastRow = sheet.getLastRow();
    const newId = lastRow; // ใช้เลขแถวปัจจุบันเป็น ID (หาก Sheet มี Header, ID จะเริ่มที่ 1 สำหรับข้อมูลแถว 2)

    newRow.push(newId);
    newRow.push(e.parameter.type);
    newRow.push(e.parameter.itemName);
    newRow.push(e.parameter.description);
    newRow.push(e.parameter.location);
    newRow.push(e.parameter.contactInfo);
    // ฟอร์แมตวันที่และเวลาให้เป็นภาษาไทย
    newRow.push(new Date().toLocaleString('th-TH', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    }));
    
    let imageUrl = '';
    // ตรวจสอบว่ามีไฟล์รูปภาพถูกส่งมาหรือไม่
    if (e.files && e.files.imageFile) { // 'imageFile' คือชื่อที่เรากำหนดใน formData.append() จาก script.js
      try {
        const fileBlob = e.files.imageFile;
        const folder = DriveApp.getFolderById(GOOGLE_DRIVE_FOLDER_ID);
        const uploadedFile = folder.createFile(fileBlob);
        
        // ตั้งค่าสิทธิ์ให้สามารถดูได้จากภายนอก (Anyone with the link can view)
        uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        // สร้าง URL สำหรับแสดงรูปภาพ
        // วิธีที่ 1: ใช้ webContentLink (บางทีอาจต้องล็อกอิน Google)
        // imageUrl = uploadedFile.getDownloadUrl(); // URL สำหรับดาวน์โหลด

        // วิธีที่ 2: ใช้ลิงก์แบบฝัง (embed link) ที่มักจะแสดงผลได้ดีกว่าใน HTML <img> tag
        // format: https://drive.google.com/uc?export=view&id=FILE_ID
        imageUrl = `https://drive.google.com/uc?export=view&id=${uploadedFile.getId()}`;

      } catch (error) {
        Logger.log('Error uploading file to Drive: ' + error.toString());
        // หากมีข้อผิดพลาดในการอัปโหลดไฟล์ ให้บันทึก error และไม่ใส่ ImageURL
        imageUrl = ''; 
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Error uploading image: ' + error.message })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    newRow.push(imageUrl); // บันทึก URL ของรูปภาพที่อัปโหลด
    newRow.push('Active'); // เพิ่ม Status เริ่มต้นเป็น Active

    sheet.appendRow(newRow);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Data saved successfully!' })).setMimeType(ContentService.MimeType.JSON);
  }
  
  else if (e.parameter.action == 'updateStatus') {
    const password = e.parameter.password;
    if (password !== SECRET_PASSWORD) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unauthorized' })).setMimeType(ContentService.MimeType.JSON);
    }

    const itemId = e.parameter.itemId;
    const newStatus = e.parameter.newStatus; // สามารถเป็น "Resolved", "Active", "Pending"

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf('ID');
    const statusColumnIndex = headers.indexOf('Status');

    if (idColumnIndex === -1 || statusColumnIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'ID or Status column not found in sheet. Please ensure your sheet has "ID" and "Status" headers.' })).setMimeType(ContentService.MimeType.JSON);
    }

    let updated = false;
    for (let i = 1; i < data.length; i++) { // เริ่มจากแถวที่ 2 (ข้อมูล)
      if (data[i][idColumnIndex] !== undefined && data[i][idColumnIndex] !== null && data[i][idColumnIndex].toString() === itemId) { // ตรวจสอบค่าก่อนเรียก toString()
        sheet.getRange(i + 1, statusColumnIndex + 1).setValue(newStatus);
        updated = true;
        break;
      }
    }

    if (updated) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: `Item ${itemId} status updated to ${newStatus}` })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `Item ${itemId} not found.` })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' })).setMimeType(ContentService.MimeType.JSON);
}

// ฟังก์ชันสำหรับจัดการ GET Request (ดึงข้อมูล)
function doGet(e) {
  if (e.parameter.action == 'getData') {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const range = sheet.getDataRange();
    const values = range.getValues();

    if (values.length < 1) { // ตรวจสอบว่ามีข้อมูลอย่างน้อย Header
      return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }

    const headers = values[0]; // แถวแรกคือ header
    const data = [];

    for (let i = 1; i < values.length; i++) { // เริ่มจากแถวที่ 2 (ข้อมูล)
      const row = values[i];
      const rowObject = {};
      for (let j = 0; j < headers.length; j++) {
        rowObject[headers[j]] = row[j];
      }
      data.push(rowObject);
    }

    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' })).setMimeType(ContentService.MimeType.JSON);
}

// ฟังก์ชันสำหรับทดสอบ (คุณสามารถลบได้)
function testLog() {
  Logger.log("Hello, Apps Script!");
}