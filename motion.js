/* =====================================================================
   Cinematic Motion Module
   - Section reveal with mask wipes
   - Parallax for hero, day folders, bento, profile
   - Mouse-tracked tilt on cards / images
   - Scroll-driven Ken Burns on bento images
   - Smooth easing (cubic) and rAF throttling
   ===================================================================== */
(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    /* -------- 1. SECTION REVEAL (mask wipe + fade) -------- */
    const revealTargets = document.querySelectorAll(
        'section, .card, .stat-card, .tool-card, .schedule-day, .day-folder, .bento-item, .kanban-column'
    );
    revealTargets.forEach(el => el.classList.add('cine-reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                // small stagger based on element index in viewport
                const delay = (i % 6) * 60;
                setTimeout(() => entry.target.classList.add('cine-in'), delay);
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealTargets.forEach(el => revealObserver.observe(el));

    /* -------- 2. PARALLAX (rAF, transform-only) -------- */
    const parallaxItems = [];

    // Hero floating items (deeper movement)
    document.querySelectorAll('.float-item').forEach((el, i) => {
        parallaxItems.push({ el, speed: 0.18 + (i % 3) * 0.06, axis: 'y' });
    });

    // Day folders — gentle Y parallax + subtle X drift
    document.querySelectorAll('.day-folder').forEach((el, i) => {
        parallaxItems.push({ el, speed: 0.06 + (i % 2) * 0.03, axis: 'y' });
    });

    // Bento images (post-load, observed dynamically)
    const bentoObserver = new MutationObserver(() => bindBento());
    const bentoGrid = document.getElementById('album-grid');
    if (bentoGrid) bentoObserver.observe(bentoGrid, { childList: true });

    function bindBento() {
        document.querySelectorAll('.bento-item').forEach((el, i) => {
            if (el.dataset.parallaxBound) return;
            el.dataset.parallaxBound = '1';
            parallaxItems.push({ el, speed: 0.05 + (i % 3) * 0.025, axis: 'y' });
        });
    }
    bindBento();

    // Hero grid — slow drift (background-position)
    const heroGrid = document.querySelector('.hero-bg-grid');

    let scrollY = window.scrollY;
    let ticking = false;

    function onScroll() {
        scrollY = window.scrollY;
        if (!ticking) {
            window.requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }

    function updateParallax() {
        parallaxItems.forEach(item => {
            const rect = item.el.getBoundingClientRect();
            // Only run when reasonably near viewport
            if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
            const center = rect.top + rect.height / 2 - window.innerHeight / 2;
            const offset = -center * item.speed;
            // Preserve any existing scale/rotate from CSS by stacking transform var
            item.el.style.setProperty('--py', `${offset.toFixed(2)}px`);
        });
        if (heroGrid) {
            heroGrid.style.transform = `translate3d(0, ${(scrollY * 0.25).toFixed(2)}px, 0)`;
        }
        ticking = false;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    updateParallax();

    /* -------- 3. MOUSE TILT — cards / images -------- */
    const tiltTargets = document.querySelectorAll(
        '.card, .stat-card, .tool-card, .schedule-day, .day-folder, .bento-item, .focus-center-container'
    );
    const tiltMax = 6; // degrees
    const tiltLerp = 0.12;

    tiltTargets.forEach(el => {
        let tx = 0, ty = 0, cx = 0, cy = 0;
        let raf = null;
        let active = false;

        const enter = () => {
            active = true;
            el.classList.add('tilt-active');
            loop();
        };
        const move = (e) => {
            const r = el.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width;
            const py = (e.clientY - r.top) / r.height;
            cx = (py - 0.5) * -2 * tiltMax;
            cy = (px - 0.5) *  2 * tiltMax;
        };
        const leave = () => {
            active = false;
            cx = 0; cy = 0;
            el.classList.remove('tilt-active');
        };
        const loop = () => {
            tx += (cx - tx) * tiltLerp;
            ty += (cy - ty) * tiltLerp;
            el.style.setProperty('--tx', `${tx.toFixed(2)}deg`);
            el.style.setProperty('--ty', `${ty.toFixed(2)}deg`);
            if (Math.abs(cx - tx) > 0.05 || Math.abs(cy - ty) > 0.05 || active) {
                raf = requestAnimationFrame(loop);
            } else {
                el.style.setProperty('--tx', `0deg`);
                el.style.setProperty('--ty', `0deg`);
            }
        };

        el.addEventListener('mouseenter', enter);
        el.addEventListener('mousemove', move);
        el.addEventListener('mouseleave', leave);
    });

    /* -------- 4. SCROLL-DRIVEN KEN BURNS on bento images -------- */
    function applyKenBurns() {
        document.querySelectorAll('.bento-item').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > window.innerHeight) return;
            const progress = 1 - (rect.top + rect.height / 2) / window.innerHeight;
            const scale = 1.05 + progress * 0.08;
            const shiftX = (progress - 0.5) * 6;
            const shiftY = (progress - 0.5) * 4;
            el.style.setProperty('--bx', `${shiftX.toFixed(2)}%`);
            el.style.setProperty('--by', `${shiftY.toFixed(2)}%`);
            el.style.setProperty('--bs', scale.toFixed(3));
        });
    }
    let kbTick = false;
    window.addEventListener('scroll', () => {
        if (!kbTick) {
            requestAnimationFrame(() => { applyKenBurns(); kbTick = false; });
            kbTick = true;
        }
    }, { passive: true });
    applyKenBurns();

    /* -------- 5. HERO content depth — mouse drift -------- */
    const hero = document.querySelector('.hero');
    const heroContent = document.querySelector('.hero-content');
    if (hero && heroContent) {
        let hx = 0, hy = 0, tgtX = 0, tgtY = 0;
        hero.addEventListener('mousemove', (e) => {
            const r = hero.getBoundingClientRect();
            tgtX = ((e.clientX - r.left) / r.width  - 0.5) * 14;
            tgtY = ((e.clientY - r.top)  / r.height - 0.5) * 10;
        });
        hero.addEventListener('mouseleave', () => { tgtX = 0; tgtY = 0; });

        (function animateHero() {
            hx += (tgtX - hx) * 0.06;
            hy += (tgtY - hy) * 0.06;
            heroContent.style.transform = `translate3d(${hx.toFixed(2)}px, ${hy.toFixed(2)}px, 0)`;
            document.querySelectorAll('.float-item').forEach((f, i) => {
                const depth = 0.6 + (i % 3) * 0.4;
                f.style.transform = `translate3d(${(hx * depth).toFixed(2)}px, ${(hy * depth).toFixed(2)}px, 0)`;
            });
            requestAnimationFrame(animateHero);
        })();
    }
})();
