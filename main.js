
// DOM Elements
const heroSection = document.querySelector('#hero');
const heroWrapper = document.querySelector('.hero-wrapper');
const postersSection = document.querySelector('#posters');
const postersWrapper = document.querySelector('.posters-wrapper');
const hamburger = document.querySelector('.hamburger-btn');
const mobileMenu = document.querySelector('.mobile-menu-overlay');

// SMOOTH SCROLL FOR NAVIGATION LINKS
function smoothScrollTo(target) {
    const element = document.querySelector(target);
    if (element) {
        const navHeight = document.querySelector('.fixed-nav').offsetHeight;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navHeight;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

// MENU LOGIC
if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        mobileMenu.classList.toggle('active');
    });

    // Close menu when link is clicked and smooth scroll
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = link.getAttribute('href');
            
            // If it's a PDF download link or external HTML page, don't prevent default
            if (link.classList.contains('nav-download') || target.endsWith('.pdf') || target.endsWith('.html')) {
                hamburger.classList.remove('active');
                mobileMenu.classList.remove('active');
                return; // Let the browser handle the download/navigation
            }
            
            e.preventDefault();
            hamburger.classList.remove('active');
            mobileMenu.classList.remove('active');
            
            // Small delay to allow menu to close before scrolling
            setTimeout(() => {
                smoothScrollTo(target);
            }, 300);
        });
    });
}

// Desktop navigation smooth scroll
const desktopLinks = document.querySelectorAll('.desktop-links a');
desktopLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const target = link.getAttribute('href');
        
        // If it's a PDF download link or external HTML page, don't prevent default
        if (link.classList.contains('nav-download') || target.endsWith('.pdf') || target.endsWith('.html')) {
            return; // Let the browser handle the download/navigation
        }
        
        e.preventDefault();
        smoothScrollTo(target);
    });
});

// Utils
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

// HORIZONTAL SCROLL LOGIC
// We will transform vertical scroll progress into horizontal translation for sticky sections
function handleHorizontalScroll() {
    const sections = [
        { container: heroSection, wrapper: heroWrapper },
        { container: postersSection, wrapper: postersWrapper }
    ];

    sections.forEach(({ container, wrapper }) => {
        if (!container || !wrapper) return;

        const rect = container.getBoundingClientRect();
        const sectionTop = rect.top;
        const sectionHeight = rect.height;
        const windowHeight = window.innerHeight;

        // Calculate how far we are into the section
        // 0 = entered top, 1 = finished
        // We want the scroll to start when the section hits the top of the viewport (sticky)
        // The section is valid for "sticky" scrolling when top <= 0 and bottom >= windowHeight

        // Actually, simple calculation:
        // percentage = -rect.top / (rect.height - window.innerHeight)
        // We stick from top:0 until we scroll past.

        let percentage = -sectionTop / (sectionHeight - windowHeight);

        // Clamp 0 to 1
        percentage = Math.max(0, Math.min(percentage, 1));

        // Move horizontal wrapper
        // Max movement = wrapper.scrollWidth - window.innerWidth
        const maxScroll = wrapper.scrollWidth - window.innerWidth;

        // Only apply if desktop (check for sticky capability logic or width)
        if (window.innerWidth > 768) {
            wrapper.style.transform = `translateX(${-percentage * maxScroll}px)`;
        } else {
            wrapper.style.transform = 'none';
        }
    });
}

// PARALLAX LOGIC
const parallaxElements = document.querySelectorAll('.parallax-element');

function handleParallax() {
    parallaxElements.forEach(el => {
        let speed = parseFloat(el.dataset.speed || 0.1);

        // Boost speed on mobile because usage space is smaller
        if (window.innerWidth < 768) {
            speed = speed * 1.5;
        }

        const rect = el.getBoundingClientRect();
        // Calculate position relative to viewport center
        const centerY = window.innerHeight / 2;
        const elementY = rect.top + rect.height / 2;
        const distFromCenter = elementY - centerY;

        // Move element
        el.style.transform = `translateY(${distFromCenter * speed}px)`;
    });
}

// POSTER ZOOM ON SCROLL
const posterSection = document.querySelector('#posters');
const posterIntro = document.querySelector('.poster-intro');

function handlePosterZoom() {
    if (!posterSection || !posterIntro) return;

    const rect = posterSection.getBoundingClientRect();
    const sectionTop = rect.top;
    const sectionHeight = rect.height;
    const windowHeight = window.innerHeight;

    // Calculate how far into the section we are (0 to 1)
    let scrollProgress = (windowHeight - sectionTop) / (windowHeight + sectionHeight);
    scrollProgress = Math.max(0, Math.min(scrollProgress, 1));

    // Calculate zoom level (0.8 to 1.2)
    const minZoom = 0.8;
    const maxZoom = 1.2;
    const zoom = minZoom + (maxZoom - minZoom) * scrollProgress;

    // Apply zoom to poster intro
    posterIntro.style.transform = `scale(${zoom})`;
}

// MOUSE PARALLAX (Subtle)
const aboutSection = document.querySelector('#about');
const aboutVisual = document.querySelector('.about-visual');

if (aboutSection) {
    aboutSection.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 20;
        const y = (e.clientY / window.innerHeight - 0.5) * 20;

        if (aboutVisual) {
            aboutVisual.style.transform = `translate(${x}px, ${y}px)`;
        }
    });
}


// SIGNATURE ANIMATION
const observerOptions = {
    threshold: 0.5
};

const signatureObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate');
        }
    });
}, observerOptions);

const sigContainer = document.querySelector('.signature-container');
if (sigContainer) signatureObserver.observe(sigContainer);


// ANIMATE ON SCROLL OBSERVER
const scrollObserverOptions = {
    threshold: 0.1
};

const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, scrollObserverOptions);

const animateElements = document.querySelectorAll('.animate-on-scroll');
animateElements.forEach(el => scrollObserver.observe(el));

// HERO SLIDES SCROLL ANIMATION (Mobile)
const heroSlideObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.3 });

// Observe hero slides for mobile scroll animations
const heroSlides = document.querySelectorAll('.hero-slide-1, .hero-slide-2, .hero-slide-3');
heroSlides.forEach(slide => heroSlideObserver.observe(slide));


// MAIN LOOP
function animate() {
    handleHorizontalScroll();
    handleParallax();
    handlePosterZoom();
    requestAnimationFrame(animate);
}

// Init
animate();
