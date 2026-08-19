// Initialize Lenis Smooth Scroll
let lenis;
if (window.innerWidth > 768 && typeof Lenis !== 'undefined' && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        smoothTouch: false,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
}

// DOM Elements
const heroSection = document.querySelector('#hero');
const heroWrapper = document.querySelector('.hero-wrapper');
const postersSection = document.querySelector('#posters');
const postersWrapper = document.querySelector('.posters-wrapper');
const hamburger = document.querySelector('.hamburger-btn');
const mobileMenu = document.querySelector('.mobile-menu-overlay');

// NAVIGATION & SMOOTH SCROLL
function scrollToTarget(target) {
    const element = document.querySelector(target);
    if (element) {
        const navHeight = document.querySelector('.fixed-nav').offsetHeight;
        if (lenis) {
            lenis.scrollTo(element, {
                offset: -navHeight,
                duration: 1.2
            });
        } else {
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - navHeight;
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }
}

// MENU LOGIC
if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('active');
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = link.getAttribute('href');
            if (link.classList.contains('nav-download') || target.endsWith('.pdf') || target.endsWith('.html')) {
                hamburger.classList.remove('active');
                mobileMenu.classList.remove('active');
                return;
            }
            e.preventDefault();
            hamburger.classList.remove('active');
            mobileMenu.classList.remove('active');
            
            setTimeout(() => {
                scrollToTarget(target);
            }, 300);
        });
    });
}

const desktopLinks = document.querySelectorAll('.desktop-links a');
desktopLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const target = link.getAttribute('href');
        if (link.classList.contains('nav-download') || target.endsWith('.pdf') || target.endsWith('.html')) {
            return;
        }
        e.preventDefault();
        scrollToTarget(target);
    });
});

// GSAP SCROLLTRIGGERS AND RESPONSIVE MEDIA MATCHING
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    let mm = gsap.matchMedia();

    // Desktop viewport matching (min-width: 769px)
    mm.add("(min-width: 769px)", () => {
        // Hero horizontal scroll
        if (heroSection && heroWrapper) {
            const maxScroll = heroWrapper.scrollWidth - window.innerWidth;
            gsap.to(heroWrapper, {
                x: -maxScroll,
                ease: 'none',
                scrollTrigger: {
                    trigger: heroSection,
                    start: 'top top',
                    end: 'bottom bottom',
                    scrub: 1,
                    invalidateOnRefresh: true,
                }
            });
        }

        // Posters horizontal scroll
        if (postersSection && postersWrapper) {
            const maxScroll = postersWrapper.scrollWidth - window.innerWidth;
            gsap.to(postersWrapper, {
                x: -maxScroll,
                ease: 'none',
                scrollTrigger: {
                    trigger: postersSection,
                    start: 'top top',
                    end: 'bottom bottom',
                    scrub: 1,
                    invalidateOnRefresh: true,
                }
            });

            // Zoom poster intro text on scroll
            const posterIntro = document.querySelector('.poster-intro');
            if (posterIntro) {
                gsap.fromTo(posterIntro, 
                    { scale: 0.8 },
                    {
                        scale: 1.15,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: postersSection,
                            start: 'top bottom',
                            end: 'bottom top',
                            scrub: true
                        }
                    }
                );
            }
        }

        // GSAP Parallax
        const parallaxElements = document.querySelectorAll('.parallax-element');
        parallaxElements.forEach(el => {
            const speed = parseFloat(el.dataset.speed || 0.1);
            gsap.fromTo(el,
                { y: -80 * speed },
                {
                    y: 80 * speed,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: true
                    }
                }
            );
        });
    });

    // Mobile viewport matching (max-width: 768px)
    mm.add("(max-width: 768px)", () => {
        let mobileParallaxFrame;
        function handleMobileParallax() {
            const parallaxElements = document.querySelectorAll('.parallax-element');
            parallaxElements.forEach(el => {
                const speed = parseFloat(el.dataset.speed || 0.1) * 0.4;
                const rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0) {
                    const distFromCenter = (rect.top + rect.height/2) - window.innerHeight/2;
                    el.style.transform = `translateY(${distFromCenter * speed}px)`;
                }
            });
            mobileParallaxFrame = requestAnimationFrame(handleMobileParallax);
        }
        mobileParallaxFrame = requestAnimationFrame(handleMobileParallax);

        // Cleanup callback when switching viewports
        return () => {
            cancelAnimationFrame(mobileParallaxFrame);
            const parallaxElements = document.querySelectorAll('.parallax-element');
            parallaxElements.forEach(el => el.style.transform = '');
        };
    });
}

// INTERACTIVE MOUSE CUSTOM CURSOR
const cursorDot = document.querySelector('.custom-cursor-dot');
const cursorRing = document.querySelector('.custom-cursor-ring');

let mouseX = -100, mouseY = -100;
let ringX = -100, ringY = -100;
let isMoving = false;

window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    isMoving = true;

    if (cursorDot) {
        cursorDot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
    }
});

// Cursor smooth following loop (lerp)
function updateCursorRing() {
    const delay = 6;
    ringX += (mouseX - ringX) / delay;
    ringY += (mouseY - ringY) / delay;

    if (cursorRing && isMoving) {
        cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
    }
    requestAnimationFrame(updateCursorRing);
}
updateCursorRing();

// Custom cursor hover states
const hoverables = document.querySelectorAll('a, button, .project-card, .certificate-row, .tech-item, .hamburger-btn');
hoverables.forEach(el => {
    el.addEventListener('mouseenter', () => {
        if (cursorRing) cursorRing.classList.add('hovered');
    });
    el.addEventListener('mouseleave', () => {
        if (cursorRing) cursorRing.classList.remove('hovered');
    });
});

// Magnetic Elements Pull Effect
const magneticElements = document.querySelectorAll('.hero-social a, .hamburger-btn, .desktop-links a, .nav-download');
if (window.innerWidth > 768) {
    magneticElements.forEach(el => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const elX = rect.left + rect.width / 2;
            const elY = rect.top + rect.height / 2;

            const pullStrength = 0.35;
            const x = (e.clientX - elX) * pullStrength;
            const y = (e.clientY - elY) * pullStrength;

            el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.05)`;
            
            ringX = elX + x * 0.4;
            ringY = elY + y * 0.4;
        });

        el.addEventListener('mouseleave', () => {
            el.style.transform = '';
        });
    });
}

// PROJECT CARD GLOW COORDINATES
const projectCards = document.querySelectorAll('.project-card');
projectCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});

// ABOUT MOUSE PARALLAX
const aboutSection = document.querySelector('#about');
const aboutVisual = document.querySelector('.about-visual');
if (aboutSection && aboutVisual && window.innerWidth > 768) {
    aboutSection.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 20;
        const y = (e.clientY / window.innerHeight - 0.5) * 20;
        aboutVisual.style.transform = `translate(${x}px, ${y}px)`;
    });
    aboutSection.addEventListener('mouseleave', () => {
        aboutVisual.style.transform = '';
    });
}

// TEXT REVEAL SPLIT AND ANIMATION
function setupTextReveal() {
    const targets = document.querySelectorAll('.hero-title, .exp-title, .stack-section h2, .certificates-section h2, .poster-intro h2, .projects-section h2, .contact-section h2');
    
    targets.forEach(target => {
        const childNodes = Array.from(target.childNodes);
        target.innerHTML = '';
        
        let wordCounter = 0;
        
        childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                const words = text.split(' ');
                
                words.forEach((word, wordIndex) => {
                    if (word === '') return;
                    
                    const wordSpan = document.createElement('span');
                    wordSpan.className = 'reveal-text-word';
                    
                    const chars = word.split('');
                    chars.forEach((char, charIndex) => {
                        const charSpan = document.createElement('span');
                        charSpan.className = 'reveal-text-char';
                        charSpan.innerText = char;
                        charSpan.style.transitionDelay = `${(wordCounter * 2 + charIndex) * 0.02}s`;
                        wordSpan.appendChild(charSpan);
                    });
                    
                    target.appendChild(wordSpan);
                    wordCounter++;
                    
                    if (wordIndex < words.length - 1) {
                        target.appendChild(document.createTextNode(' '));
                    }
                });
            } else if (node.nodeName === 'BR') {
                target.appendChild(document.createElement('br'));
            } else {
                target.appendChild(node.cloneNode(true));
            }
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.querySelectorAll('.reveal-text-char').forEach(char => {
                        char.style.transform = 'translateY(0)';
                    });
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        observer.observe(target);
    });
}
setupTextReveal();

// SIGNATURE DRAWING OBSERVER
const observerOptions = {
    threshold: 0.5
};

const signatureObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
            signatureObserver.unobserve(entry.target);
        }
    });
}, observerOptions);

const sigContainer = document.querySelector('.signature-container');
if (sigContainer) signatureObserver.observe(sigContainer);

// TIMELINE ELEMENT ENTRANCE ANIMATION
const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            scrollObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

const animateElements = document.querySelectorAll('.animate-on-scroll, .timeline, .timeline-item, .hero-panel.hero-slide-1, .hero-panel.hero-slide-2, .hero-panel.hero-slide-3');
animateElements.forEach(el => scrollObserver.observe(el));

// CERTIFICATES INTERACTIVE LOGIC (Row Hover & Lightbox Modal)
const certRows = document.querySelectorAll('.certificate-row');
const certPreview = document.querySelector('.cert-floating-preview');
const certPreviewImg = certPreview ? certPreview.querySelector('img') : null;
const lightbox = document.querySelector('.lightbox-modal');
const lightboxImg = lightbox ? lightbox.querySelector('.lightbox-content img') : null;
const lightboxClose = lightbox ? lightbox.querySelector('.lightbox-close') : null;

// Cursor hover image preview (Desktop only)
if (window.innerWidth > 768 && certRows.length && certPreview && certPreviewImg) {
    certRows.forEach(row => {
        row.addEventListener('mouseenter', () => {
            const imgSrc = row.getAttribute('data-image');
            if (imgSrc) {
                certPreviewImg.src = imgSrc;
                certPreview.classList.add('active');
            }
        });

        row.addEventListener('mouseleave', () => {
            certPreview.classList.remove('active');
        });

        row.addEventListener('mousemove', (e) => {
            const offset = 20; // Offset preview card from actual mouse pointer
            certPreview.style.left = `${e.clientX + offset}px`;
            certPreview.style.top = `${e.clientY + offset}px`;
        });
    });
}

// Lightbox Modal for click zoom (Both desktop and mobile)
if (lightbox && lightboxImg && certRows.length) {
    certRows.forEach(row => {
        row.addEventListener('click', () => {
            const imgSrc = row.getAttribute('data-image');
            if (imgSrc) {
                lightboxImg.src = imgSrc;
                lightbox.classList.add('active');
                lightbox.setAttribute('aria-hidden', 'false');
                if (lenis) lenis.stop(); // Stop scroll while modal is active
            }
        });
    });

    const closeLightbox = () => {
        lightbox.classList.remove('active');
        lightbox.setAttribute('aria-hidden', 'true');
        if (lenis) lenis.start(); // Resume scrolling
    };

    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }

    // Close on background overlay click
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Close on Esc key press
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
}

// ==========================================================================
// ADVANCED NEON PARTICLE TRAILS (Canvas Constellation Overlay)
// ==========================================================================
const trailCanvas = document.getElementById('trail-canvas');
const trailCtx = trailCanvas ? trailCanvas.getContext('2d') : null;
let trailParticles = [];

if (trailCanvas && trailCtx && window.innerWidth > 768) {
    const resizeTrailCanvas = () => {
        trailCanvas.width = window.innerWidth;
        trailCanvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeTrailCanvas);
    resizeTrailCanvas();

    class TrailParticle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 3 + 1.5;
            this.speedX = (Math.random() - 0.5) * 1.2;
            this.speedY = (Math.random() - 0.5) * 1.2;
            this.color = '#c4ff00';
            this.opacity = 1;
            this.fadeSpeed = Math.random() * 0.012 + 0.008;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.opacity -= this.fadeSpeed;
        }

        draw() {
            trailCtx.save();
            trailCtx.globalAlpha = this.opacity;
            trailCtx.shadowBlur = 8;
            trailCtx.shadowColor = this.color;
            trailCtx.fillStyle = this.color;
            trailCtx.beginPath();
            trailCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            trailCtx.fill();
            trailCtx.restore();
        }
    }

    window.addEventListener('mousemove', (e) => {
        for (let i = 0; i < 2; i++) {
            trailParticles.push(new TrailParticle(e.clientX, e.clientY));
        }
    });

    function handleTrailParticles() {
        trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
        
        for (let i = 0; i < trailParticles.length; i++) {
            trailParticles[i].update();
            trailParticles[i].draw();
            
            // Draw connector lines between nearby particles
            for (let j = i + 1; j < trailParticles.length; j++) {
                const dx = trailParticles[i].x - trailParticles[j].x;
                const dy = trailParticles[i].y - trailParticles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 70) {
                    trailCtx.save();
                    trailCtx.strokeStyle = `rgba(196, 255, 0, ${trailParticles[i].opacity * 0.15})`;
                    trailCtx.lineWidth = 0.8;
                    trailCtx.beginPath();
                    trailCtx.moveTo(trailParticles[i].x, trailParticles[i].y);
                    trailCtx.lineTo(trailParticles[j].x, trailParticles[j].y);
                    trailCtx.stroke();
                    trailCtx.restore();
                }
            }

            if (trailParticles[i].opacity <= 0) {
                trailParticles.splice(i, 1);
                i--;
            }
        }
        requestAnimationFrame(handleTrailParticles);
    }
    handleTrailParticles();
}

// ==========================================================================
// TACTILE UI SOUND DESIGN (Web Audio Synth Oscillator click notes)
// ==========================================================================
let audioCtx = null;
let isAudioMuted = true; // default mute to obey user control and autoplay rules

const soundOnIcons = document.querySelectorAll('.sound-on');
const soundOffIcons = document.querySelectorAll('.sound-off');
const mobileSoundToggles = document.querySelectorAll('.mobile-sound-toggle');
const soundToggleButtons = document.querySelectorAll('.sound-toggle-btn');

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playUISound(frequency = 700, duration = 0.08, type = 'sine') {
    if (isAudioMuted || !audioCtx) return;
    try {
        initAudioContext();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        
        gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (err) {
        console.warn("Sound play error:", err);
    }
}

function toggleAudioState() {
    isAudioMuted = !isAudioMuted;
    if (!isAudioMuted) {
        initAudioContext();
        playUISound(440, 0.15, 'triangle'); // sound feedback tone
    }

    soundToggleButtons.forEach(btn => {
        const soundOn = btn.querySelector('.sound-on');
        const soundOff = btn.querySelector('.sound-off');
        if (soundOn && soundOff) {
            if (isAudioMuted) {
                soundOn.style.display = 'none';
                soundOff.style.display = 'block';
            } else {
                soundOn.style.display = 'block';
                soundOff.style.display = 'none';
            }
        }
    });

    mobileSoundToggles.forEach(btn => {
        btn.innerText = isAudioMuted ? 'Sound: Muted' : 'Sound: Active';
    });
}

// Bind Mute Toggle click events
soundToggleButtons.forEach(btn => btn.addEventListener('click', toggleAudioState));
mobileSoundToggles.forEach(btn => btn.addEventListener('click', toggleAudioState));

// Connect hover/clicks sound notes
const hoverSoundItems = document.querySelectorAll('a, button, .certificate-row, .project-card, .tech-item');
hoverSoundItems.forEach(el => {
    el.addEventListener('mouseenter', () => {
        if (!isAudioMuted) {
            playUISound(600, 0.04, 'sine');
        }
    });
    el.addEventListener('click', () => {
        if (!isAudioMuted) {
            playUISound(850, 0.1, 'sine');
        }
    });
});
