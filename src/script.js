// 导航栏交互
document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      navToggle.classList.toggle('active');
    });
  }

  // 滚动导航栏样式
  const updateNavOnScroll = () => {
    const scrolled = window.scrollY > 50;
    const nav = document.querySelector('.navbar');
    if (nav) {
      if (scrolled) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    }

    // 更新当前活动链接
    const sections = document.querySelectorAll('section');
    let current = null;
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= 150 && rect.bottom > 150) {
        current = section;
        break;
      }
    }

    if (current) {
      const currentId = current.getAttribute('id');
      document.querySelectorAll('.nav-link').forEach(link => {
        const linkId = link.getAttribute('href');
        if (linkId === '#' + currentId) {
          document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }
  };

  window.addEventListener('scroll', () => {
    updateNavOnScroll();

    // 卡片滚动进入动画
    const cards = document.querySelectorAll('.feature-card, .ending-card, .game-card, .stat-item');
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        card.classList.add('visible');
      } else {
        card.classList.remove('visible');
      }
    }
  });
  updateNavOnScroll();

  // 链接点击处理
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const navMenuEl = document.getElementById('nav-menu');
      if (navMenuEl) {
        navMenuEl.classList.remove('active');
      }
      const navToggleEl = document.getElementById('nav-toggle');
      if (navToggleEl) {
        navToggleEl.classList.remove('active');
      }
    });
  });

  // iframe 加载
  const gameFrame = document.getElementById('game-frame');
  if (gameFrame) {
    gameFrame.addEventListener('load', () => {
      console.log('游戏已就绪');
    });
  }
});
