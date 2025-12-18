// UYGULAMA AYARLARI
const APP_CONFIG = {
    SHORT_CODE_LENGTH: 6,
    MAX_CUSTOM_CODE_LENGTH: 30,
    RECENT_LINKS_LIMIT: 10,
    QR_CODE_SIZE: 150,
    TOAST_DURATION: 3000
};

// UYGULAMA DURUMU
let currentShortCode = '';
let currentShortUrl = '';

// SAYFA YÜKLENDİĞİNDE
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 LinkShort uygulaması başlatılıyor...');
    
    // Yönlendirme kontrolü
    checkForRedirect();
    
    // Verileri yükle
    loadRecentLinks();
    updateStats();
    
    // Event listener'ları ekle
    setupEventListeners();
    
    // Domain prefix'i güncelle
    updateDomainPrefix();
    
    console.log('✅ Uygulama hazır!');
});

// EVENT LISTENER'LARI KUR
function setupEventListeners() {
    // Enter tuşu ile kısaltma
    document.getElementById('urlInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            shortenUrl();
        }
    });
    
    // Özel kod input'u için validation
    document.getElementById('customCode').addEventListener('input', function(e) {
        // Sadece harf, rakam, tire ve alt çizgi
        this.value = this.value.replace(/[^A-Za-z0-9\-_]/g, '');
    });
    
    // URL input'u değiştiğinde result'ı gizle
    document.getElementById('urlInput').addEventListener('input', function() {
        if (this.value.trim() === '') {
            document.getElementById('resultCard').style.display = 'none';
        }
    });
}

// DOMAIN PREFIX'İ GÜNCELLE
function updateDomainPrefix() {
    document.getElementById('domainPrefix').textContent = 'methehan.github.io/linkshortener/';
}

// ÖZEL KOD BÖLÜMÜNÜ AÇ/KAPA
function toggleCustomCode() {
    const section = document.getElementById('customCodeSection');
    const icon = document.getElementById('toggleIcon');
    
    if (section.style.display === 'none' || !section.style.display) {
        section.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        section.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

// URL KISALTMA FONKSİYONU
async function shortenUrl() {
    const urlInput = document.getElementById('urlInput');
    const customCodeInput = document.getElementById('customCode');
    const button = document.getElementById('shortenBtn');
    
    const originalUrl = urlInput.value.trim();
    const customCode = customCodeInput.value.trim();
    
    // VALIDATION
    if (!originalUrl) {
        showToast('⚠️ Lütfen bir URL girin!', 'error');
        urlInput.focus();
        return;
    }
    
    if (!isValidUrl(originalUrl)) {
        showToast('❌ Geçerli bir URL girin! (http:// veya https:// ile başlamalı)', 'error');
        urlInput.focus();
        return;
    }
    
    // Özel kod validation
    if (customCode && !isValidCustomCode(customCode)) {
        showToast('❌ Özel kod sadece harf, rakam, tire ve alt çizgi içerebilir', 'error');
        customCodeInput.focus();
        return;
    }
    
    try {
        // Butonu devre dışı bırak
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İşleniyor...';
        
        // URL'nin daha önce kısaltılıp kısaltılmadığını kontrol et
        const existingUrl = await checkExistingUrl(originalUrl);
        if (existingUrl) {
            showToast('ℹ️ Bu URL daha önce kısaltılmış!', 'info');
            displayResult(existingUrl.shortCode, originalUrl, existingUrl.clicks, existingUrl.createdAt);
            return;
        }
        
        // Kısa kod oluştur
        const shortCode = customCode || generateShortCode(APP_CONFIG.SHORT_CODE_LENGTH);
        
        // Firestore'a kaydet
        const urlData = {
            originalUrl: originalUrl,
            shortCode: shortCode,
            clicks: 0,
            createdAt: new Date().toISOString(),
            createdBy: 'web',
            domain: new URL(originalUrl).hostname
        };
        
        // Firestore'a ekle
        await window.firebaseDb.collection('urls').doc(shortCode).set(urlData);
        
        // Başarı mesajı
        showToast('✅ Link başarıyla kısaltıldı!', 'success');
        
        // Sonucu göster
        displayResult(shortCode, originalUrl, 0, urlData.createdAt);
        
        // Listeleri güncelle
        loadRecentLinks();
        updateStats();
        
        // Input'ları temizle
        urlInput.value = '';
        customCodeInput.value = '';
        
    } catch (error) {
        console.error('❌ Hata:', error);
        
        if (error.code === 'permission-denied') {
            showToast('🔐 Firebase kurallarını kontrol edin!', 'error');
        } else if (error.code === 'already-exists') {
            showToast('⚠️ Bu özel kod zaten kullanılıyor!', 'error');
        } else {
            showToast(`❌ Hata: ${error.message}`, 'error');
        }
    } finally {
        // Butonu eski haline getir
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-scissors"></i> Kısalt';
    }
}

// KISA KOD OLUŞTUR
function generateShortCode(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
}

// URL GEÇERLİLİK KONTROLÜ
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// ÖZEL KOD VALIDATION
function isValidCustomCode(code) {
    const regex = /^[A-Za-z0-9\-_]+$/;
    return regex.test(code);
}

// DAHA ÖNCE KISALTILMIŞ URL KONTROLÜ
async function checkExistingUrl(url) {
    try {
        const querySnapshot = await window.firebaseDb.collection('urls')
            .where('originalUrl', '==', url)
            .limit(1)
            .get();
        
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            return {
                shortCode: doc.id,
                clicks: doc.data().clicks || 0,
                createdAt: doc.data().createdAt
            };
        }
        return null;
    } catch (error) {
        console.error('Kontrol hatası:', error);
        return null;
    }
}

// SONUCU EKRANDA GÖSTER
function displayResult(shortCode, originalUrl, clicks, createdAt) {
    currentShortCode = shortCode;
    currentShortUrl = `https://methehan.github.io/linkshortener/?r=${shortCode}`;
    
    // DOM elementlerini güncelle
    document.getElementById('shortUrlOutput').value = currentShortUrl;
    document.getElementById('originalUrlText').textContent = 
        originalUrl.length > 50 ? originalUrl.substring(0, 50) + '...' : originalUrl;
    
    document.getElementById('clickCount').textContent = clicks;
    
    // Tarihi formatla
    const date = new Date(createdAt);
    document.getElementById('createdDate').textContent = 
        date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    
    // QR kodu oluştur
    generateQRCode(currentShortUrl);
    
    // Sonuç kartını göster
    document.getElementById('resultCard').style.display = 'block';
    
    // Sayfayı kaydır
    document.getElementById('resultCard').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

// QR KODU OLUŞTUR
function generateQRCode(url) {
    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = '';
    
    QRCode.toCanvas(qrContainer, url, {
        width: APP_CONFIG.QR_CODE_SIZE,
        height: APP_CONFIG.QR_CODE_SIZE,
        margin: 2,
        color: {
            dark: '#1a1a2e',
            light: '#ffffff'
        }
    }, function(error) {
        if (error) {
            console.error('QR oluşturma hatası:', error);
            qrContainer.innerHTML = '<p style="color: #666; padding: 20px;">QR kodu oluşturulamadı</p>';
        }
    });
}

// PANOYA KOPYALA
async function copyToClipboard() {
    try {
        await navigator.clipboard.writeText(currentShortUrl);
        
        // Butonu güncelle
        const copyBtn = document.getElementById('copyBtn');
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Kopyalandı!';
        copyBtn.classList.add('copied');
        
        showToast('📋 Link panoya kopyalandı!', 'success');
        
        // 2 saniye sonra eski haline döndür
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="far fa-copy"></i> Kopyala';
            copyBtn.classList.remove('copied');
        }, 2000);
        
    } catch (err) {
        console.error('Kopyalama hatası:', err);
        showToast('❌ Kopyalama başarısız!', 'error');
    }
}

// QR KODUNU İNDİR
function downloadQR() {
    const canvas = document.querySelector('#qrCodeContainer canvas');
    if (!canvas) {
        showToast('❌ QR kodu bulunamadı!', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.download = `qr-${currentShortCode}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    showToast('📥 QR kodu indirildi!', 'success');
}

// SONUÇ KARTINI KAPAT
function closeResult() {
    document.getElementById('resultCard').style.display = 'none';
}

// YÖNLENDİRME KONTROLÜ
function checkForRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectCode = urlParams.get('r');
    
    if (redirectCode) {
        redirectToOriginal(redirectCode);
    }
}

// ORİJİNAL URL'YE YÖNLENDİR - DÜZELTİLMİŞ VERSİYON
async function redirectToOriginal(shortCode) {
    try {
        // Yönlendirme sayfasını göster
        document.body.innerHTML = `
            <div class="redirect-page">
                <div class="redirect-container">
                    <h1><i class="fas fa-external-link-alt"></i> Yönlendiriliyorsunuz...</h1>
                    <div class="redirect-loading">
                        <div class="spinner"></div>
                    </div>
                    <p>Lütfen bekleyin, orijinal siteye yönlendiriliyorsunuz.</p>
                    <p><small>Kısa kod: ${shortCode}</small></p>
                </div>
            </div>
        `;
        
        // FIREBASE 8 SYNTAX İLE DÜZELT
        const docRef = window.firebaseDb.collection('urls').doc(shortCode);
        
        // Firestore'dan veriyi al (FIREBASE 8 YÖNTEMİ)
        docRef.get().then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                // Tıklama sayısını artır
                docRef.update({
                    clicks: firebase.firestore.FieldValue.increment(1),
                    lastAccessed: new Date().toISOString()
                });
                
                // Orijinal URL'ye yönlendir
                setTimeout(() => {
                    window.location.href = data.originalUrl;
                }, 1500);
                
            } else {
                // Link bulunamadı
                document.body.innerHTML = `
                    <div class="redirect-page">
                        <div class="redirect-container">
                            <h1><i class="fas fa-unlink"></i> 404 - Link Bulunamadı</h1>
                            <p>Üzgünüz, aradığınız kısa link geçerli değil veya silinmiş.</p>
                            <a href="https://methehan.github.io/linkshortener" style="
                                display: inline-block;
                                margin-top: 20px;
                                padding: 12px 30px;
                                background: white;
                                color: #667eea;
                                text-decoration: none;
                                border-radius: 8px;
                                font-weight: 600;
                            ">
                                <i class="fas fa-home"></i> Ana Sayfaya Dön
                            </a>
                        </div>
                    </div>
                `;
            }
        }).catch((error) => {
            console.error('Firestore hatası:', error);
            document.body.innerHTML = `
                <div class="redirect-page">
                    <div class="redirect-container">
                        <h1><i class="fas fa-exclamation-triangle"></i> Hata!</h1>
                        <p>Veritabanı hatası: ${error.message}</p>
                        <a href="https://methehan.github.io/linkshortener" style="
                            display: inline-block;
                            margin-top: 20px;
                            padding: 12px 30px;
                            background: white;
                            color: #667eea;
                            text-decoration: none;
                            border-radius: 8px;
                            font-weight: 600;
                        ">
                            Ana Sayfaya Dön
                        </a>
                    </div>
                </div>
            `;
        });
        
    } catch (error) {
        console.error('Genel hata:', error);
        document.body.innerHTML = `
            <div class="redirect-page">
                <div class="redirect-container">
                    <h1><i class="fas fa-exclamation-triangle"></i> Hata!</h1>
                    <p>Bir hata oluştu: ${error.message}</p>
                    <a href="https://methehan.github.io/linkshortener" style="
                        display: inline-block;
                        margin-top: 20px;
                        padding: 12px 30px;
                        background: white;
                        color: #667eea;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 600;
                    ">
                        Ana Sayfaya Dön
                    </a>
                </div>
            </div>
        `;
    }
}

// SON LİNKLERİ YÜKLE
async function loadRecentLinks() {
    try {
        const linksList = document.getElementById('linksList');
        linksList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Yükleniyor...</p>
            </div>
        `;
        
        const querySnapshot = await window.firebaseDb.collection('urls')
            .orderBy('createdAt', 'desc')
            .limit(APP_CONFIG.RECENT_LINKS_LIMIT)
            .get();
        
        if (querySnapshot.empty) {
            linksList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-link-slash"></i>
                    <p>Henüz kısaltılmış link yok</p>
                    <small>İlk linkinizi kısaltın!</small>
                </div>
            `;
            return;
        }
        
        let linksHTML = '';
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const shortUrl = `https://methehan.github.io/linkshortener/?r=${doc.id}`;
            const domain = extractDomain(data.originalUrl);
            const date = new Date(data.createdAt);
            
            linksHTML += `
                <div class="link-item">
                    <div class="link-info">
                        <div class="link-domain">
                            <i class="fas fa-globe"></i>
                            <span>${domain}</span>
                        </div>
                        <div class="link-short">
                            <a href="${shortUrl}" target="_blank" title="${shortUrl}">
                                ${shortUrl}
                            </a>
                            <div class="link-meta">
                                <span>
                                    <i class="fas fa-mouse-pointer"></i>
                                    ${data.clicks || 0} tıklanma
                                </span>
                                <span>
                                    <i class="fas fa-hashtag"></i>
                                    ${doc.id}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="link-date">
                        ${date.toLocaleDateString('tr-TR')}
                    </div>
                </div>
            `;
        });
        
        linksList.innerHTML = linksHTML;
        
    } catch (error) {
        console.error('Link yükleme hatası:', error);
        document.getElementById('linksList').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Linkler yüklenirken hata oluştu</p>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// İSTATİSTİKLERİ GÜNCELLE
async function updateStats() {
    try {
        const querySnapshot = await window.firebaseDb.collection('urls').get();
        let totalLinks = 0;
        let totalClicks = 0;
        
        querySnapshot.forEach((doc) => {
            totalLinks++;
            totalClicks += (doc.data().clicks || 0);
        });
        
        document.getElementById('totalLinks').textContent = totalLinks;
        document.getElementById('totalClicks').textContent = totalClicks;
        
    } catch (error) {
        console.error('İstatistik güncelleme hatası:', error);
    }
}

// DOMAIN ÇIKAR
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url.substring(0, 30) + (url.length > 30 ? '...' : '');
    }
}

// TOAST MESAJI GÖSTER
function showToast(message, type = 'info') {
    // Var olan toast'ları temizle
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Yeni toast oluştur
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${getToastIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Süre sonunda kaldır
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, APP_CONFIG.TOAST_DURATION);
}

// TOAST İCON'INI BELİRLE
function getToastIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'info': return 'info-circle';
        default: return 'bell';
    }
}

// PAYLAŞIM FONKSİYONLARI
function shareOnWhatsApp() {
    const text = `Bu kısa linki paylaşıyorum: ${currentShortUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareOnTelegram() {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(currentShortUrl)}`, '_blank');
}

function shareOnTwitter() {
    const text = 'Bu kısa linki paylaşıyorum:';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(currentShortUrl)}`, '_blank');
}
