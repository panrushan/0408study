/* ================================
   极光青蓝 · 交互强化
   3D 倾斜 + 涟漪 + Hero 视差 + 卡片入场
   ================================ */

(function () {
  const supportsHover = window.matchMedia('(hover: hover)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ===== 1. 全局按钮涟漪 =====
  function initRipple() {
    if (reducedMotion) return;
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.btn, .nav-item, .tag, .feature-item');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      // 给非 .btn 元素也加涟漪样式
      if (!btn.classList.contains('btn')) {
        ripple.style.background = 'rgba(59,130,246,0.25)';
      }
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    }, { passive: true });
  }

  // ===== 2. 卡片 3D 倾斜 =====
  function initTilt() {
    if (reducedMotion || !supportsHover) return;

    const tiltCards = document.querySelectorAll('.tilt-card, .feature-item, .history-item');
    tiltCards.forEach(card => {
      const strength = parseFloat(card.dataset.tilt || '10');
      let raf = null;

      const onMove = (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rx = (0.5 - y) * strength * 2;
        const ry = (x - 0.5) * strength * 2;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
        });
      };

      const onLeave = () => {
        if (raf) cancelAnimationFrame(raf);
        card.style.transform = '';
      };

      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerleave', onLeave);
    });
  }

  // ===== 3. Aurora 背景视差 + Hero 光斑跟随 =====
  function initAurora() {
    if (reducedMotion || !supportsHover) return;

    const blobs = document.querySelectorAll('.aurora-blob');
    if (!blobs.length) return;

    let raf = null;
    const onMove = (e) => {
      const cx = (e.clientX / window.innerWidth - 0.5) * 2;
      const cy = (e.clientY / window.innerHeight - 0.5) * 2;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        blobs.forEach((blob, i) => {
          const depth = (i + 1) * 14;
          const tx = cx * depth;
          const ty = cy * depth;
          blob.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        });
      });
    };

    window.addEventListener('pointermove', onMove);
  }

  // ===== 4. Hero 区鼠标聚光（额外高光跟随） =====
  function initHeroSpotlight() {
    if (reducedMotion || !supportsHover) return;
    const hero = document.querySelector('.hero');
    if (!hero) return;

    let raf = null;
    hero.addEventListener('pointermove', (e) => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
      const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        hero.style.background =
          `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.25) 0%, transparent 35%), var(--grad-aurora)`;
      });
    });

    hero.addEventListener('pointerleave', () => {
      hero.style.background = '';
    });
  }

  // ===== 5. 卡片入场观察器 =====
  function initReveal() {
    if (reducedMotion) {
      document.querySelectorAll('.card, .ingredient-item').forEach(el => el.classList.add('revealed'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.card').forEach(el => io.observe(el));
  }

  // ===== 启动 =====
  function initAll() {
    initRipple();
    initTilt();
    initAurora();
    initHeroSpotlight();
    initReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  window.SkincareTilt = { initTilt, initAurora, initReveal, initRipple, initHeroSpotlight, initAll };
})();
