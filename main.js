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

// GSAP HORIZONTAL SCROLL & ANIMATIONS (Desktop only)
if (window.innerWidth > 768 && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    // Register GSAP ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

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
} else {
    // Fallback parallax for mobile (simple loop to keep mobile high performance)
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
        requestAnimationFrame(handleMobileParallax);
    }
    requestAnimationFrame(handleMobileParallax);
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
        const text = target.innerText;
        target.innerHTML = '';
        
        const words = text.split(' ');
        words.forEach((word, wordIndex) => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'reveal-text-word';
            
            const chars = word.split('');
            chars.forEach((char, charIndex) => {
                const charSpan = document.createElement('span');
                charSpan.className = 'reveal-text-char';
                charSpan.innerText = char;
                charSpan.style.transitionDelay = `${(wordIndex * 2 + charIndex) * 0.02}s`;
                wordSpan.appendChild(charSpan);
            });
            
            target.appendChild(wordSpan);
            if (wordIndex < words.length - 1) {
                target.appendChild(document.createTextNode(' '));
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

const animateElements = document.querySelectorAll('.animate-on-scroll, .timeline, .timeline-item');
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
