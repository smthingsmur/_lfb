// *** เปลี่ยนตรงนี้เป็น Web App URL ของ Google Apps Script ของคุณ ***
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwvKxdvzYqg8dBy18SZrHMvIU4LEq-9VqAjTAp8HZ065H1JgPNETq5h9aO2wuXT-g--PA/exec'; 

document.addEventListener('DOMContentLoaded', () => {
    loadItems(); // โหลดข้อมูลเมื่อหน้าเว็บโหลดเสร็จ
    
    // ตั้งค่า Event Listener สำหรับ Submit Form
    const postForm = document.getElementById('post-form');
    postForm.addEventListener('submit', handlePostSubmit);

    // ตั้งค่า Event Listener สำหรับ Tab Buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            showTab(button.getAttribute('onclick').replace("showTab('", "").replace("')", ""));
        });
    });
});

// ฟังก์ชันสลับ Tab
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`).classList.add('active');

    // ถ้าเปลี่ยนมาที่ View Items tab ให้โหลดข้อมูลใหม่
    if (tabId === 'viewItems') {
        loadItems();
    }
}

// ฟังก์ชันโหลดข้อมูลจาก Google Apps Script
async function loadItems() {
    const itemsListDiv = document.getElementById('items-list');
    itemsListDiv.innerHTML = '<p>Loading items...</p>'; // แสดงสถานะโหลด

    try {
        const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=getData`);
        const data = await response.json();

        if (data && data.length > 0) {
            // กรองและเรียงลำดับ: Active/Pending ก่อน, และเรียงจากใหม่ไปเก่า
            const activeAndPendingItems = data.filter(item => item.Status === 'Active' || item.Status === 'Pending');
            const resolvedItems = data.filter(item => item.Status === 'Resolved');

            // ใช้ DatePosted เป็น Date object เพื่อเปรียบเทียบ
            const sortedActiveAndPendingItems = activeAndPendingItems.sort((a, b) => new Date(b.DatePosted) - new Date(a.DatePosted));
            const sortedResolvedItems = resolvedItems.sort((a, b) => new Date(b.DatePosted) - new Date(a.DatePosted));

            const displayItems = sortedActiveAndPendingItems.concat(sortedResolvedItems); // แสดง Active/Pending ก่อน Resolved

            itemsListDiv.innerHTML = ''; // ล้างข้อมูลเก่า
            displayItems.forEach(item => {
                const itemCard = document.createElement('div');
                // เพิ่มคลาสตามสถานะเพื่อจัดสไตล์
                itemCard.className = `item-card ${item.Status ? item.Status.toLowerCase() : 'active'}`; // ใช้ active เป็นค่า default ถ้า Status ไม่มี

                const statusTagClass = item.Type === 'Lost' ? 'lost' : 'found';

                // สร้างกลุ่มปุ่มสำหรับการเปลี่ยนสถานะ
                let statusButtons = '';
                if (item.Status !== 'Resolved') {
                    statusButtons = `
                        <div class="status-action-buttons">
                            ${item.Status !== 'Active' ? `<button class="action-button mark-active-button" data-item-id="${item.ID}" data-item-name="${item.ItemName}" data-new-status="Active">Mark as Active</button>` : ''}
                            ${item.Status !== 'Pending' ? `<button class="action-button mark-pending-button" data-item-id="${item.ID}" data-item-name="${item.ItemName}" data-new-status="Pending">Mark as Pending</button>` : ''}
                            <button class="action-button mark-resolved-button" data-item-id="${item.ID}" data-item-name="${item.ItemName}" data-new-status="Resolved">Mark as Resolved</button>
                        </div>
                    `;
                }

                itemCard.innerHTML = `
                    <span class="status-tag ${statusTagClass}">${item.Type}</span>
                    <h3 class="item-name">${item.ItemName}</h3>
                    <p><span class="label">Status:</span> <span class="item-status status-${item.Status ? item.Status.toLowerCase() : 'active'}">${item.Status || 'Active'}</span></p>
                    <p><span class="label">Description:</span> ${item.Description || '-'}</p>
                    <p><span class="label">Location:</span> ${item.Location}</p>
                    <p><span class="label">Contact:</span> ${item.ContactInfo}</p>
                    <p><span class="label">Posted On:</span> ${item.DatePosted}</p>
                    ${item.ImageURL ? `<img src="${item.ImageURL}" alt="${item.ItemName}">` : ''}
                    ${statusButtons}
                `;
                itemsListDiv.appendChild(itemCard);
            });

            // เพิ่ม Event Listener ให้กับปุ่มเปลี่ยนสถานะทั้งหมด
            document.querySelectorAll('.mark-active-button, .mark-pending-button, .mark-resolved-button').forEach(button => {
                button.addEventListener('click', handleStatusChange);
            });

        } else {
            itemsListDiv.innerHTML = '<p>No items found yet.</p>';
        }
    } catch (error) {
        console.error('Error loading items:', error);
        itemsListDiv.innerHTML = '<p style="color: red;">Error loading items. Please try again later.</p>';
    }
}

// ฟังก์ชันใหม่สำหรับจัดการการคลิกปุ่มเปลี่ยนสถานะ
async function handleStatusChange(event) {
    const itemId = event.target.dataset.itemId;
    const itemName = event.target.dataset.itemName;
    const newStatus = event.target.dataset.newStatus;
    
    // ขอรหัสผ่านเพื่อยืนยันการเปลี่ยนสถานะ
    const password = prompt(`Enter admin password to mark "${itemName}" (ID: ${itemId}) as ${newStatus}:`);
    if (!password) {
        alert('Password required to change status.');
        return;
    }

    if (!confirm(`Are you sure you want to mark "${itemName}" (ID: ${itemId}) as ${newStatus}?`)) {
        return;
    }

    event.target.textContent = 'Updating...';
    event.target.disabled = true;

    const formData = new FormData();
    formData.append('action', 'updateStatus');
    formData.append('password', password);
    formData.append('itemId', itemId);
    formData.append('newStatus', newStatus); 

    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.status === 'success') {
            alert(result.message);
            loadItems(); // โหลดข้อมูลใหม่เพื่อให้สถานะอัปเดตบนหน้าเว็บ
        } else {
            alert(`Error: ${result.message}`);
            event.target.textContent = `Mark as ${newStatus}`; // คืนค่าข้อความเดิม
            event.target.disabled = false;
        }
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Network error or server issue. Could not update status.');
        event.target.textContent = `Mark as ${newStatus}`; // คืนค่าข้อความเดิม
        event.target.disabled = false;
    }
}

// ฟังก์ชันจัดการการ Submit Form
async function handlePostSubmit(event) {
    event.preventDefault(); // ป้องกันการ reload หน้าเว็บ

    const postStatus = document.getElementById('post-status');
    postStatus.style.color = 'black';
    postStatus.textContent = 'Submitting...';

    const password = document.getElementById('post-password').value;
    const type = document.getElementById('type').value;
    const itemName = document.getElementById('itemName').value;
    const description = document.getElementById('description').value;
    const location = document.getElementById('location').value;
    const contactInfo = document.getElementById('contactInfo').value;
    
    // เปลี่ยนจาก imageURL เป็น imageFile
    const imageInput = document.getElementById('imageFile');
    const imageFile = imageInput.files[0]; // ดึงไฟล์แรกที่ผู้ใช้เลือก

    if (!password || !type || !itemName || !location || !contactInfo) {
        postStatus.style.color = 'red';
        postStatus.textContent = 'Please fill in all required fields (including password).';
        return;
    }

    const formData = new FormData();
    formData.append('action', 'postData');
    formData.append('password', password);
    formData.append('type', type);
    formData.append('itemName', itemName);
    formData.append('description', description);
    formData.append('location', location);
    formData.append('contactInfo', contactInfo);
    
    // เพิ่มไฟล์รูปภาพลงใน FormData ถ้ามี
    if (imageFile) {
        formData.append('imageFile', imageFile); // ใช้ชื่อ 'imageFile'
    }

    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.status === 'success') {
            postStatus.style.color = 'green';
            postStatus.textContent = result.message;
            event.target.reset(); // ล้างฟอร์ม
            showTab('viewItems'); // ไปที่หน้าแสดงข้อมูล
        } else {
            postStatus.style.color = 'red';
            postStatus.textContent = result.message || 'Error submitting data.';
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        postStatus.style.color = 'red';
        postStatus.textContent = 'Network error or server issue. Please try again.';
    }
}


