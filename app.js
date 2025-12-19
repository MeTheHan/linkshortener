// UYGULAMA AYARLARI
const APP_CONFIG = {
    SHORT_CODE_LENGTH: 6,
    MAX_CUSTOM_CODE_LENGTH: 30,
    RECENT_LINKS_LIMIT: 10,
    TOAST_DURATION: 3000
};

// UYGULAMA DURUMU
let currentShortCode = '';
let currentShortUrl = '';
let recaptchaVerified = false;

// SAYFA YÜKLENDİĞİNDE
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 LinkShort uygulaması başlatılıyor...');
    
    // Yönlendirme kontrolü
    checkForRedirect();
    
    // Event listener'ları kur
    setupEventListeners();
    
    // Verileri yükle
    loadRecentLinks();
    updateStats();
    
    // Özel kod bölümünü başlangıçta gizle
    document.getElementById('customCodeSection').style.display = 'none';
    
    console.log('✅ Uygulama hazır!');
});

// EVENT LISTENER'LARI KUR
function setupEventListeners() {
    console.log('📝 Event listeners kuruluyor...');
    
    // 1. KISALT BUTONU (reCAPTCHA kontrolü ile)
    document.getElementById('shortenBtn').addEventListener('click', function() {
        if (!recaptchaVerified) {
            showRecaptchaError();
            return;
        }
        shortenUrl();
    });
    
    // 2. ENTER TUŞU İLE KISALTMA
    document.getElementById('urlInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            if (!recaptchaVerified) {
                showRecaptchaError();
                return;
            }
            shortenUrl();
        }
    });
    
    // 3. ÖZEL KOD TOGGLE BUTONU
    document.getElementById('toggleCustomCodeBtn').addEventListener('click', function() {
        const section = document.getElementById('customCodeSection');
        const icon = document.getElementById('toggleIcon');
        
        if (section.style.display === 'none' || section.style.display === '') {
            section.style.display = 'block';
            icon.style.transform = 'rotate(180deg)';
            console.log('📂 Özel kod bölümü AÇILDI');
            
            // Input'a focus yap
            setTimeout(() => {
                document.getElementById('customCode').focus();
            }, 300);
        } else {
            section.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
            console.log('📂 Özel kod bölümü KAPANDI');
        }
    });
    
    // 4. ÖZEL KOD INPUT VALIDATION
    document.getElementById('customCode').addEventListener('input', function(e) {
        // Sadece izin verilen karakterler
        this.value = this.value.replace(/[^A-Za-z0-9\-_]/g, '');
        
        // Küçük harfe çevir (opsiyonel)
        this.value = this.value.toLowerCase();
    });
    
    // 5. DİĞER BUTONLAR
    document.getElementById('copyBtn').addEventListener('click', copyToClipboard);
    document.getElementById('copyLinkBtn').addEventListener('click', copyToClipboard);
    document.getElementById('closeResultBtn').addEventListener('click', closeResult);
    document.getElementById('testLinkBtn').addEventListener('click', testLink);
    document.getElementById('newLinkBtn').addEventListener('click', newLink);
    document.getElementById('whatsappBtn').addEventListener('click', shareOnWhatsApp);
    document.getElementById('telegramBtn').addEventListener('click', shareOnTelegram);
    document.getElementById('twitterBtn').addEventListener('click', shareOnTwitter);
    document.getElementById('refreshLinksBtn').addEventListener('click', loadRecentLinks);
    
    // 6. YouTube butonları
    document.querySelectorAll('a[href*="youtube.com"]').forEach(link => {
        link.addEventListener('click', function(e) {
            console.log('📺 YouTube linkine tıklandı:', this.href);
            // Yeni sekmede açılacak (target="_blank" zaten var)
        });
    });
    
    // 7. URL DEĞİŞTİĞİNDE RESULT'I GİZLE
    document.getElementById('urlInput').addEventListener('input', function() {
        if (this.value.trim() === '') {
            document.getElementById('resultCard').style.display = 'none';
        }
    });
    
    console.log('✅ Event listeners kuruldu!');
}

// ===== reCAPTCHA FONKSİYONLARI =====
function onRecaptchaSuccess(response) {
    console.log('✅ reCAPTCHA doğrulandı:', response);
    recaptchaVerified = true;
    
    // Hata mesajını gizle
    document.getElementById('recaptchaError').classList.remove('show');
    
    // Görsel feedback
    const recaptchaSection = document.querySelector('.recaptcha-section');
    recaptchaSection.classList.remove('error');
    recaptchaSection.classList.add('verified');
    
    showToast('✅ Güvenlik doğrulaması başarılı! Artık link kısaltabilirsiniz.', 'success');
}

function onRecaptchaExpired() {
    console.log('⚠️ reCAPTCHA süresi doldu');
    recaptchaVerified = false;
    
    // reCAPTCHA'yı resetle
    if (typeof grecaptcha !== 'undefined') {
        grecaptcha.reset();
    }
    
    // Görsel feedback
    document.querySelector('.recaptcha-section').classList.remove('verified');
    
    showToast('⚠️ Doğrulama süresi doldu, lütfen tekrar yapın!', 'warning');
}

function onRecaptchaError() {
    console.log('❌ reCAPTCHA hatası');
    recaptchaVerified = false;
    showRecaptchaError();
    showToast('❌ Doğrulama hatası! Lütfen sayfayı yenileyip tekrar deneyin.', 'error');
}

function showRecaptchaError() {
    document.getElementById('recaptchaError').classList.add('show');
    document.querySelector('.recaptcha-section').classList.add('error');
    
    // Titreşim efekti (varsa)
    if (navigator.vibrate) navigator.vibrate(200);
}

function resetRecaptcha() {
    if (typeof grecaptcha !== 'undefined') {
        grecaptcha.reset();
    }
    recaptchaVerified = false;
    document.querySelector('.recaptcha-section').classList.remove('verified');
    document.getElementById('recaptchaError').classList.remove('show');
}

// ===== URL KISALTMA FONKSİYONU =====
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
    if (customCode) {
        if (!isValidCustomCode(customCode)) {
            showToast('❌ Özel kod sadece harf, rakam, tire ve alt çizgi içerebilir', 'error');
            customCodeInput.focus();
            return;
        }
        
        if (customCode.length < 2) {
            showToast('❌ Özel kod en az 2 karakter olmalı!', 'error');
            customCodeInput.focus();
            return;
        }
        
        if (customCode.length > 30) {
            showToast('❌ Özel kod en fazla 30 karakter olabilir!', 'error');
            customCodeInput.focus();
            return;
        }
        
        // Türkçe karakter kontrolü
        const turkishChars = /[çÇğĞıİöÖşŞüÜ]/;
        if (turkishChars.test(customCode)) {
            showToast('❌ Özel kod Türkçe karakter içeremez! (İngilizce karakterler kullanın)', 'error');
            customCodeInput.focus();
            return;
        }
        
        // Özel kodun daha önce kullanılıp kullanılmadığını kontrol et
        try {
            const codeExists = await checkExistingCode(customCode);
            if (codeExists) {
                showToast(`❌ "${customCode}" kodu zaten kullanılıyor! Başka bir kod deneyin.`, 'error');
                customCodeInput.focus();
                return;
            }
        } catch (error) {
            console.error('Kod kontrol hatası:', error);
            showToast('❌ Kod kontrolü sırasında hata!', 'error');
            return;
        }
    }
    
    try {
        // Butonu devre dışı bırak
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İşleniyor...';
        
        // URL'nin daha önce kısaltılıp kısaltılmadığını kontrol et
        const existingUrl = await checkExistingUrl(originalUrl);
        if (existingUrl) {
            showToast('ℹ️ Bu URL daha önce kısaltılmış! Mevcut linkinizi kullanabilirsiniz.', 'info');
            displayResult(existingUrl.shortCode, originalUrl, existingUrl.clicks, existingUrl.createdAt);
            return;
        }
        
        // Kısa kod oluştur
        let shortCode;
        if (customCode) {
            shortCode = customCode;
        } else {
            shortCode = await generateUniqueShortCode();
        }
        
        // Firestore'a kaydet
        const urlData = {
            originalUrl: originalUrl,
            shortCode: shortCode,
            clicks: 0,
            createdAt: new Date().toISOString(),
            createdBy: 'web',
            domain: new URL(originalUrl).hostname,
            isCustom: !!customCode
        };
        
        await window.firebaseDb.collection('urls').doc(shortCode).set(urlData);
        
        // Başarı mesajı
        if (customCode) {
            showToast(`🎉 Özel kodunuz oluşturuldu: "${shortCode}"`, 'success');
        } else {
            showToast('✅ Link başarıyla kısaltıldı!', 'success');
        }
        
        // Sonucu göster
        displayResult(shortCode, originalUrl, 0, urlData.createdAt, !!customCode);
        
        // Listeleri güncelle
        loadRecentLinks();
        updateStats();
        
        // Input'ları temizle ve reCAPTCHA'yı resetle
        urlInput.value = '';
        customCodeInput.value = '';
        resetRecaptcha();
        
        // Özel kod bölümünü gizle
        document.getElementById('customCodeSection').style.display = 'none';
        document.getElementById('toggleIcon').style.transform = 'rotate(0deg)';
        
    } catch (error) {
        console.error('❌ Hata:', error);
        
        if (error.code === 'permission-denied') {
            showToast('🔐 Firebase kurallarını kontrol edin!', 'error');
        } else {
            showToast(`❌ Hata: ${error.message}`, 'error');
        }
    } finally {
        // Butonu eski haline getir
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-scissors"></i> Kısalt';
    }
}

// ===== YARDIMCI FONKSİYONLAR =====
async function checkExistingCode(code) {
    try {
        const docRef = window.firebaseDb.collection('urls').doc(code);
        const doc = await docRef.get();
        return doc.exists;
    } catch (error) {
        console.error('Kod kontrol hatası:', error);
        return false;
    }
}

async function generateUniqueShortCode() {
    let code;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
        code = generateShortCode(APP_CONFIG.SHORT_CODE_LENGTH);
        const exists = await checkExistingCode(code);
        if (!exists) return code;
        attempts++;
    } while (attempts < maxAttempts);
    
    return generateShortCode(APP_CONFIG.SHORT_CODE_LENGTH + 3);
}

function generateShortCode(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function isValidCustomCode(code) {
    const regex = /^[A-Za-z0-9\-_]+$/;
    return regex.test(code);
}

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

// ===== SONUÇ GÖSTERME =====
function displayResult(shortCode, originalUrl, clicks, createdAt, isCustom = false) {
    currentShortCode = shortCode;
    
    // Link oluştur
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
    
    // Özel kod kullanıldıysa ekstra mesaj
    if (isCustom) {
        const originalUrlElement = document.querySelector('.original-url');
        originalUrlElement.innerHTML += `<br><small style="color: #4361ee; font-weight: bold;">
            <i class="fas fa-star"></i> Özel kodunuz: <strong>${shortCode}</strong>
        </small>`;
    }
    
    // Sonuç kartını göster
    document.getElementById('resultCard').style.display = 'block';
    
    // Sayfayı kaydır
    document.getElementById('resultCard').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

async function copyToClipboard() {
    try {
        await navigator.clipboard.writeText(currentShortUrl);
        
        const copyBtn = document.getElementById('copyBtn');
        const copyLinkBtn = document.getElementById('copyLinkBtn');
        
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Kopyalandı!';
        copyBtn.classList.add('copied');
        
        copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Kopyalandı!';
        copyLinkBtn.classList.add('copied');
        
        showToast('📋 Link panoya kopyalandı! Artık paylaşabilirsiniz.', 'success');
        
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="far fa-copy"></i> Kopyala';
            copyBtn.classList.remove('copied');
            
            copyLinkBtn.innerHTML = '<i class="fas fa-link"></i> Link Kopyala';
            copyLinkBtn.classList.remove('copied');
        }, 2000);
        
    } catch (err) {
        console.error('Kopyalama hatası:', err);
        showToast('❌ Kopyalama başarısız! Lütfen tekrar deneyin.', 'error');
    }
}

function testLink() {
    if (!currentShortUrl) {
        showToast('❌ Önce bir link oluşturun!', 'error');
        return;
    }
    
    window.open(currentShortUrl, '_blank');
    showToast('🔗 Link yeni sekmede açılıyor...', 'info');
}

function newLink() {
    document.getElementById('resultCard').style.display = 'none';
    document.getElementById('urlInput').value = '';
    document.getElementById('urlInput').focus();
    showToast('✨ Yeni link oluşturmaya hazırsınız!', 'info');
}

function closeResult() {
    document.getElementById('resultCard').style.display = 'none';
}

// ===== YÖNLENDİRME =====
function checkForRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectCode = urlParams.get('r');
    
    if (redirectCode) {
        redirectToOriginal(redirectCode);
    }
}

async function redirectToOriginal(shortCode) {
    try {
        document.body.innerHTML = `
            <div class="redirect-page">
                <div class="redirect-container">
                    <h1><i class="fas fa-external-link-alt"></i> Yönlendiriliyorsunuz...</h1>
                    <div class="redirect-loading">
                        <div class="spinner"></div>
                    </div>
                    <p>Lütfen bekleyin, orijinal siteye yönlendiriliyorsunuz.</p>
                    <p><small>Kısa kod: ${shortCode}</small></p>
                    <div class="youtube-redirect-promo">
                        <p><i class="fab fa-youtube"></i> YouTube kanalımıza abone olmayı unutmayın: <strong>@MTechnoW</strong></p>
                    </div>
                </div>
            </div>
        `;
        
        const docRef = window.firebaseDb.collection('urls').doc(shortCode);
        
        docRef.get().then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                
                // Tıklama sayısını artır
                docRef.update({
                    clicks: firebase.firestore.FieldValue.increment(1),
                    lastAccessed: new Date().toISOString()
                });
                
                setTimeout(() => {
                    window.location.href = data.originalUrl;
                }, 1500);
                
            } else {
                document.body.innerHTML = `
                    <div class="redirect-page">
                        <div class="redirect-container">
                            <h1><i class="fas fa-unlink"></i> 404 - Link Bulunamadı</h1>
                            <p>Üzgünüz, aradığınız kısa link geçerli değil veya silinmiş.</p>
                            <div class="youtube-redirect-promo">
                                <p><i class="fab fa-youtube"></i> Bu arada YouTube kanalımıza göz atın: <strong>@MTechnoW</strong></p>
                            </div>
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

// ===== SON LİNKLER VE İSTATİSTİKLER =====
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
            const isCustom = data.isCustom ? '<span class="custom-badge"><i class="fas fa-star"></i> Özel</span>' : '';
            
            linksHTML += `
                <div class="link-item">
                    <div class="link-info">
                        <div class="link-domain">
                            <i class="fas fa-globe"></i>
                            <span>${domain}</span>
                            ${isCustom}
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
        
        // Link item'lara tıklama event'i ekle
        document.querySelectorAll('.link-item a').forEach(link => {
            link.addEventListener('click', function(e) {
                console.log('Son linke tıklandı:', this.href);
            });
        });
        
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

async function updateStats() {
    try {
        const querySnapshot = await window.firebaseDb.collection('urls').get();
        let totalLinks = 0;
        let totalClicks = 0;
        let customLinks = 0;
        
        querySnapshot.forEach((doc) => {
            totalLinks++;
            totalClicks += (doc.data().clicks || 0);
            if (doc.data().isCustom) customLinks++;
        });
        
        document.getElementById('totalLinks').textContent = totalLinks;
        document.getElementById('totalClicks').textContent = totalClicks;
        
        // YouTube kanal istatistiği (opsiyonel)
        console.log(`📊 İstatistikler: ${totalLinks} link, ${totalClicks} tıklanma, ${customLinks} özel kod`);
        
    } catch (error) {
        console.error('İstatistik güncelleme hatası:', error);
    }
}

function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url.substring(0, 30) + (url.length > 30 ? '...' : '');
    }
}

// ===== TOAST MESAJLARI =====
function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${getToastIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, APP_CONFIG.TOAST_DURATION);
}

function getToastIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'info': return 'info-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'bell';
    }
}

// ===== PAYLAŞIM FONKSİYONLARI =====
function shareOnWhatsApp() {
    if (!currentShortUrl) {
        showToast('❌ Önce bir link oluşturun!', 'error');
        return;
    }
    
    const text = `Bu kısa linki paylaşıyorum: ${currentShortUrl}\n\n👉 YouTube Kanalımız: https://www.youtube.com/@MTechnoW`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    showToast('📱 WhatsApp paylaşımı açılıyor...', 'info');
}

function shareOnTelegram() {
    if (!currentShortUrl) {
        showToast('❌ Önce bir link oluşturun!', 'error');
        return;
    }
    
    const text = `Bu kısa linki paylaşıyorum: ${currentShortUrl}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(currentShortUrl)}&text=${encodeURIComponent(text)}`, '_blank');
    showToast('✈️ Telegram paylaşımı açılıyor...', 'info');
}

function shareOnTwitter() {
    if (!currentShortUrl) {
        showToast('❌ Önce bir link oluşturun!', 'error');
        return;
    }
    
    const text = `Bu kısa linki paylaşıyorum: ${currentShortUrl}\n\n👉 YouTube: @MTechnoW`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    showToast('🐦 Twitter paylaşımı açılıyor...', 'info');
}

// ===== EKSTRA ÖZELLİKLER =====
// YouTube kanalını rastgele hatırlat
setTimeout(() => {
    const youtubePromoMessages = [
        "📺 YouTube kanalımıza göz atmayı unutmayın: @MTechnoW",
        "🎥 Teknoloji videoları için YouTube: @MTechnoW",
        "👨‍💻 Kod dersleri ve ipuçları: YouTube'da @MTechnoW",
        "🔔 YouTube kanalımıza abone olun: @MTechnoW"
    ];
    
    const randomMessage = youtubePromoMessages[Math.floor(Math.random() * youtubePromoMessages.length)];
    
    // Sadece bazen göster (10% ihtimal)
    if (Math.random() < 0.1) {
        showToast(randomMessage, 'info');
    }
}, 30000); // 30 saniye sonra
