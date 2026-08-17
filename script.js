(function() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const galleryGrid = document.getElementById('galleryGrid');
    const formatSelect = document.getElementById('formatSelect');
    const qualityRange = document.getElementById('qualityRange');
    const qualityValue = document.getElementById('qualityValue');
    const convertAllBtn = document.getElementById('convertAllBtn');
    const saveAllBtn = document.getElementById('saveAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    let imageItems = [];
    let idCounter = 0;
    let isConverting = false;

    qualityRange.addEventListener('input', () => {
        qualityValue.textContent = qualityRange.value + '%';
    });

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    // --- Hapus satu item berdasarkan ID ---
    function deleteItem(id) {
        const index = imageItems.findIndex(item => item.id === id);
        if (index === -1) return;
        
        const item = imageItems[index];
        // Revoke object URL untuk membersihkan memory
        if (item.originalImage && item.originalImage.src && item.originalImage.src.startsWith('blob:')) {
            URL.revokeObjectURL(item.originalImage.src);
        }
        if (item.convertedBlob) {
            // Blob akan di-revoke saat garbage collection, tapi kita bisa bantu
        }
        
        imageItems.splice(index, 1);
        renderGallery();
    }

    // --- Download satu item ---
    function downloadItem(id) {
        const item = imageItems.find(it => it.id === id);
        if (!item) return;
        if (!item.convertedBlob || item.status !== 'done') {
            alert('File belum dikonversi atau gagal.');
            return;
        }
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(item.convertedBlob);
        link.download = item.convertedName || `gambar_${item.id}.${formatSelect.value}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 3000);
    }

    function renderGallery() {
        if (imageItems.length === 0) {
            galleryGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-images" style="font-size: 2.2rem; color: #b6d4e6; margin-bottom: 8px; display: block;"></i>
                    Belum ada gambar. Upload file untuk memulai.
                </div>
            `;
            saveAllBtn.disabled = true;
            return;
        }

        let html = '';
        let hasConverted = false;
        for (const item of imageItems) {
            const statusClass = item.status === 'done' ? 'done' : (item.status === 'error' ? 'error' : '');
            const statusText = item.status === 'done' ? '✓ Selesai' : (item.status === 'error' ? 'Gagal' : 'Menunggu');

            let src = '#';
            if (item.convertedBlob) {
                src = URL.createObjectURL(item.convertedBlob);
            } else if (item.originalImage) {
                src = item.originalImage.src;
            }

            const isDone = item.status === 'done';
            const isError = item.status === 'error';

            html += `
                <div class="card" data-id="${item.id}">
                    <img class="card-img" src="${src}" alt="${item.name}" loading="lazy">
                    <div class="card-name">${item.name}</div>
                    <div class="card-meta">${formatFileSize(item.size)}</div>
                    <span class="card-status ${statusClass}">${statusText}</span>
                    <div class="card-actions">
                        ${isDone ? `<button class="btn btn-success btn-sm download-single" data-id="${item.id}"><i class="fas fa-download"></i></button>` : ''}
                        <button class="btn btn-danger btn-sm delete-single" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
            if (item.convertedBlob) hasConverted = true;
        }

        galleryGrid.innerHTML = html;
        saveAllBtn.disabled = !hasConverted;

        // Event listener untuk tombol download per item
        document.querySelectorAll('.download-single').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                downloadItem(id);
            });
        });

        // Event listener untuk tombol hapus per item
        document.querySelectorAll('.delete-single').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (confirm('Hapus file ini dari daftar?')) {
                    deleteItem(id);
                }
            });
        });
    }

    function addFiles(files) {
        // Terima file gambar DAN PDF
        const validFiles = Array.from(files).filter(f => {
            return f.type.startsWith('image/') || 
                   f.type === 'application/pdf' || 
                   f.name.toLowerCase().endsWith('.pdf');
        });
        
        if (validFiles.length === 0) {
            alert('Tidak ada file gambar yang valid.');
            return;
        }

        for (const file of validFiles) {
            console.log('File ditambahkan:', file.name, file.type); 
            const id = idCounter++;
            const item = {
                id,
                file,
                name: file.name,
                size: file.size,
                originalImage: null,
                convertedBlob: null,
                convertedName: '',
                status: 'waiting',
                error: null,
                isPdf: file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
            };

            // KALAU PDF → langsung render tanpa preview gambar
            if (item.isPdf) {
                // Buat preview icon PDF
                const canvas = document.createElement('canvas');
                canvas.width = 200;
                canvas.height = 200;
                const ctx = canvas.getContext('2d');
                
                // Background putih
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(0, 0, 200, 200);
                
                // Icon PDF
                ctx.fillStyle = '#e74c3c';
                ctx.font = 'bold 80px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('PDF', 100, 100);
                
                ctx.fillStyle = '#333';
                ctx.font = '20px Arial';
                ctx.fillText('📄', 100, 150);
                
                // Simpan sebagai image dummy
                const img = new Image();
                img.onload = () => {
                    item.originalImage = img;
                    renderGallery();
                };
                img.src = canvas.toDataURL('image/png');
                
                // Tampilkan di gallery
                imageItems.push(item);  //
                renderGallery();
                continue;
            }

            // KALAU GAMBAR → load seperti biasa
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    item.originalImage = img;
                    renderGallery();
                };
                img.onerror = () => {
                    item.status = 'error';
                    item.error = 'Gagal memuat gambar';
                    renderGallery();
                };
                img.src = e.target.result;
            };
            reader.onerror = () => {
                item.status = 'error';
                item.error = 'Gagal membaca file';
                renderGallery();
            };
            reader.readAsDataURL(file);

            imageItems.push(item);
        }
        renderGallery();
    }

    // --- Konversi ---
     async function convertAll() {
        if (isConverting) return;
        if (imageItems.length === 0) {
            alert('Tidak ada gambar.');
            return;
        }

        const pending = imageItems.filter(it => it.status !== 'done' && it.status !== 'error');
        if (pending.length === 0) {
            alert('Semua gambar sudah dikonversi atau gagal.');
            return;
        }

        isConverting = true;
        convertAllBtn.disabled = true;
        convertAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengonversi...';

        const targetFormat = formatSelect.value;
        const quality = parseInt(qualityRange.value, 10) / 100;

        let mimeType = `image/${targetFormat}`;
        if (targetFormat === 'jpg' || targetFormat === 'jpeg') mimeType = 'image/jpeg';
        else if (targetFormat === 'ico') mimeType = 'image/x-icon';
        else if (targetFormat === 'tiff') mimeType = 'image/tiff';
        else if (targetFormat === 'avif') mimeType = 'image/avif';

        const extMap = {
            'jpg': 'jpg', 'jpeg': 'jpg', 'png': 'png', 'webp': 'webp',
            'bmp': 'bmp', 'ico': 'ico', 'tiff': 'tiff', 'gif': 'gif',
            'avif': 'avif', 'pdf': 'pdf'
        };
        const ext = extMap[targetFormat] || targetFormat;

        for (const item of imageItems) {
            if (item.status === 'done' || item.status === 'error') continue;
            
            // CEK APAKAH FILE PDF
            const isPdfInput = item.file && (item.file.type === 'application/pdf' || 
                               item.file.name.toLowerCase().endsWith('.pdf'));

            // KALAU INPUT PDF TAPI TARGET BUKAN PDF → PAKAI PDF.js
            if (isPdfInput && targetFormat !== 'pdf') {
                try {
                    if (typeof pdfjsLib === 'undefined') {
                        throw new Error('Library PDF.js tidak ditemukan.');
                    }

                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

                    const arrayBuffer = await item.file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 1.5 });
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    
                    await page.render({ canvasContext: context, viewport: viewport }).promise;

                    let blob = await new Promise((resolve) => {
                        canvas.toBlob((b) => resolve(b), mimeType, quality);
                    });

                    if (!blob) {
                        item.status = 'error';
                        item.error = 'Gagal konversi PDF ke gambar';
                    } else {
                        const baseName = item.file.name.replace(/\.[^.]+$/, '') || 'file';
                        const newName = `${baseName}.${ext}`;
                        item.convertedBlob = blob;
                        item.convertedName = newName;
                        item.status = 'done';
                        item.error = null;
                    }
                } catch (err) {
                    console.error('Error konversi PDF:', err);
                    item.status = 'error';
                    item.error = err.message || 'Error konversi PDF';
                }
                renderGallery();
                continue;
            }

            // KALAU INPUT PDF TARGET PDF → COPY
            if (isPdfInput && targetFormat === 'pdf') {
                try {
                    const blob = await item.file.arrayBuffer().then(buf => new Blob([buf], { type: 'application/pdf' }));
                    const baseName = item.file.name.replace(/\.[^.]+$/, '') || 'file';
                    const newName = `${baseName}.pdf`;
                    item.convertedBlob = blob;
                    item.convertedName = newName;
                    item.status = 'done';
                    item.error = null;
                } catch (err) {
                    console.error('Error copy PDF:', err);
                    item.status = 'error';
                    item.error = err.message || 'Error copy PDF';
                }
                renderGallery();
                continue;
            }

            // KALAU INPUT GAMBAR (LANJUTKAN SEPERTI BIASA)
            if (!item.originalImage) {
                item.status = 'error';
                item.error = 'Gambar tidak siap';
                renderGallery();
                continue;
            }

            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const width = item.originalImage.width;
                const height = item.originalImage.height;
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(item.originalImage, 0, 0, width, height);

                let blob = null;

                // --- PDF menggunakan jsPDF ---
                if (targetFormat === 'pdf') {
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const { jsPDF } = window.jspdf;
                    
                    const ratio = width / height;
                    let pdfWidth, pdfHeight;
                    const maxDim = 595.28;
                    if (ratio >= 1) {
                        pdfWidth = Math.min(width * 0.75, maxDim);
                        pdfHeight = pdfWidth / ratio;
                    } else {
                        pdfHeight = Math.min(height * 0.75, maxDim);
                        pdfWidth = pdfHeight * ratio;
                    }
                    
                    const pdf = new jsPDF({
                        orientation: pdfWidth >= pdfHeight ? 'landscape' : 'portrait',
                        unit: 'pt',
                        format: [pdfWidth, pdfHeight]
                    });
                    
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                    const pdfBlob = pdf.output('blob');
                    
                    if (pdfBlob && pdfBlob.size > 0) {
                        blob = pdfBlob;
                    } else {
                        throw new Error('PDF yang dihasilkan kosong');
                    }
                } else {
                    blob = await new Promise((resolve) => {
                        canvas.toBlob((b) => resolve(b), mimeType, quality);
                    });
                }

                if (!blob) {
                    item.status = 'error';
                    item.error = 'Gagal konversi (blob null)';
                } else {
                    const baseName = item.file.name.replace(/\.[^.]+$/, '') || 'gambar';
                    const newName = `${baseName}.${ext}`;
                    item.convertedBlob = blob;
                    item.convertedName = newName;
                    item.status = 'done';
                    item.error = null;
                }
            } catch (err) {
                console.error('Error konversi:', err);
                item.status = 'error';
                item.error = err.message || 'Error konversi';
            }
            renderGallery();
        }

        isConverting = false;
        convertAllBtn.disabled = false;
        convertAllBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Konversi Semua';
        renderGallery();
    }
    
    // --- Save All dengan logika: 1-3 langsung, >3 ZIP ---
    function saveAll() {
        const doneItems = imageItems.filter(it => it.convertedBlob && it.status === 'done');
        if (doneItems.length === 0) {
            alert('Tidak ada hasil konversi.');
            return;
        }

        const count = doneItems.length;

        if (count <= 3) {
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    const item = doneItems[i];
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(item.convertedBlob);
                    link.download = item.convertedName || `gambar_${i+1}.${formatSelect.value}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(link.href), 3000);
                }, i * 350);
            }
        } else {
            if (typeof JSZip === 'undefined') {
                alert('Library JSZip tidak ditemukan. Silakan refresh halaman.');
                return;
            }
            const zip = new JSZip();
            const folder = zip.folder('hasil_konversi');

            for (const item of doneItems) {
                const fileName = item.convertedName || `gambar_${item.id}.${formatSelect.value}`;
                folder.file(fileName, item.convertedBlob);
            }

            zip.generateAsync({ type: 'blob' })
                .then((zipBlob) => {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(zipBlob);
                    link.download = `hasil_konversi_${new Date().getTime()}.zip`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
                })
                .catch((err) => {
                    alert('Gagal membuat ZIP: ' + err.message);
                });
        }
    }

    // --- Clear all ---
    function clearAll() {
        if (imageItems.length === 0) return;
        if (confirm('Hapus semua gambar dari daftar?')) {
            for (const item of imageItems) {
                if (item.originalImage && item.originalImage.src && item.originalImage.src.startsWith('blob:')) {
                    URL.revokeObjectURL(item.originalImage.src);
                }
            }
            imageItems = [];
            renderGallery();
            saveAllBtn.disabled = true;
        }
    }

    // --- Event listeners ---
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#2a7faa';
        uploadArea.style.background = '#e5f2fa';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#b6d4e6';
        uploadArea.style.background = 'white';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#b6d4e6';
        uploadArea.style.background = 'white';
        if (e.dataTransfer.files.length) {
            addFiles(e.dataTransfer.files);
            fileInput.value = '';
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length) {
            addFiles(fileInput.files);
            fileInput.value = '';
        }
    });

    convertAllBtn.addEventListener('click', convertAll);
    saveAllBtn.addEventListener('click', saveAll);
    clearAllBtn.addEventListener('click', clearAll);

    renderGallery();
    console.log('Batch Converter + ZIP siap!');
})();
