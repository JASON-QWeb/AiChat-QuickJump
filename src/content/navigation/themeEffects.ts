/**
 * 主题特效管理器
 * 用于实现圣诞和科幻主题的高级视觉效果
 */

// 获取扩展资源 URL
function getExtensionUrl(path: string): string {
  return chrome.runtime.getURL(path);
}

/**
 * 圣诞主题效果管理器
 */
export class ChristmasThemeEffects {
  private container: HTMLElement;
  private particleCanvas: HTMLCanvasElement | null = null;
  private particleCtx: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;
  private meteorInterval: ReturnType<typeof setInterval> | null = null;
  private particles: Array<{
    x: number; 
    y: number; 
    size: number; 
    speed: number; 
    opacity: number; 
    type: 'star' | 'meteor'; 
    tailLength?: number; 
    angle?: number
  }> = [];
  
  constructor(container: HTMLElement) {
    this.container = container;
  }
  
  /**
   * 初始化圣诞主题效果
   */
  init(): void {
    this.createParticleCanvas();
    this.startParticleAnimation();
  }
  
  /**
   * 创建粒子画布
   */
  private createParticleCanvas(): void {
    this.particleCanvas = document.createElement('canvas');
    this.particleCanvas.className = 'christmas-particle-canvas';
    Object.assign(this.particleCanvas.style, {
      position: 'absolute',
      top: '0',
      left: '-30px',
      width: '100px',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '0'
    });
    
    this.particleCanvas.width = 100;
    this.particleCanvas.height = this.container.clientHeight || 800;
    this.particleCtx = this.particleCanvas.getContext('2d');
    this.container.appendChild(this.particleCanvas);
  }
  
  /**
   * 开始粒子动画
   */
  private startParticleAnimation(): void {
    // 初始化一些星星粒子
    for (let i = 0; i < 12; i++) {
      this.addParticle('star');
    }
    
    // 定时添加流星
    this.meteorInterval = setInterval(() => {
      if (Math.random() < 0.25) {
        this.addParticle('meteor');
      }
    }, 2500);
    
    this.animate();
  }
  
  /**
   * 添加粒子
   */
  private addParticle(type: 'star' | 'meteor'): void {
    const canvasWidth = this.particleCanvas?.width || 100;
    
    if (type === 'star') {
      this.particles.push({
        x: Math.random() * canvasWidth,
        y: -10,
        size: Math.random() * 3 + 1,
        speed: Math.random() * 0.4 + 0.15,
        opacity: Math.random() * 0.5 + 0.3,
        type: 'star'
      });
    } else {
      this.particles.push({
        x: Math.random() * canvasWidth,
        y: -20,
        size: Math.random() * 2 + 2,
        speed: Math.random() * 1.5 + 1,
        opacity: 1,
        type: 'meteor',
        tailLength: Math.random() * 25 + 15,
        angle: Math.PI / 6 + Math.random() * 0.2
      });
    }
  }
  
  /**
   * 动画循环
   */
  private animate = (): void => {
    if (!this.particleCtx || !this.particleCanvas) return;
    
    const ctx = this.particleCtx;
    const width = this.particleCanvas.width;
    const height = this.particleCanvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    this.particles = this.particles.filter(p => {
      if (p.type === 'meteor' && p.angle) {
        p.y += p.speed;
        p.x += Math.sin(p.angle) * p.speed * 0.5;
      } else {
        p.y += p.speed;
        p.x += Math.sin(p.y * 0.02) * 0.2;
      }
      
      if (p.y > height + 50) return false;
      
      if (p.type === 'meteor' && p.tailLength) {
        const gradient = ctx.createLinearGradient(
          p.x, p.y,
          p.x - Math.sin(p.angle || 0) * p.tailLength,
          p.y - p.tailLength
        );
        gradient.addColorStop(0, `rgba(255, 215, 0, ${p.opacity})`);
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(
          p.x - Math.sin(p.angle || 0) * p.tailLength,
          p.y - p.tailLength
        );
        ctx.strokeStyle = gradient;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();
      } else {
        this.drawStar(ctx, p.x, p.y, p.size, `rgba(255, 215, 0, ${p.opacity})`);
      }
      
      return true;
    });
    
    if (Math.random() < 0.04 && this.particles.filter(p => p.type === 'star').length < 18) {
      this.addParticle('star');
    }
    
    this.animationId = requestAnimationFrame(this.animate);
  };
  
  /**
   * 绘制星星形状
   */
  private drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.save();
    ctx.beginPath();
    ctx.translate(x, y);
    
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(0, -size);
      ctx.rotate(Math.PI / 5);
      ctx.lineTo(0, -size / 2);
      ctx.rotate(Math.PI / 5);
    }
    
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.restore();
  }
  
  /**
   * 创建梦幻模糊星星顶部按钮
   */
  static createTopStar(isFavorited: boolean): string {
    const mainColor = isFavorited ? '#FFD700' : '#E0B800';
    const glowColor = isFavorited ? 'rgba(255, 215, 0, 0.8)' : 'rgba(204, 182, 56, 0.88)';
    const blurAmount = isFavorited ? '3' : '4';
    const gradientStart = isFavorited ? '#FFFACD' : '#FFF8DC';
    const gradientMid = isFavorited ? '#FFD700' : '#E0B800';
    const gradientEnd = isFavorited ? '#DAA520' : '#5C4E00';
    
    return `
      <svg width="32" height="32" viewBox="0 0 100 100" style="filter: drop-shadow(0 0 ${isFavorited ? '12' : '6'}px ${glowColor}) blur(${isFavorited ? '0' : '0.5'}px);">
        <defs>
          <linearGradient id="christmasStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${gradientStart}"/>
            <stop offset="50%" style="stop-color:${gradientMid}"/>
            <stop offset="100%" style="stop-color:${gradientEnd}"/>
          </linearGradient>
          <filter id="christmasStarGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="${blurAmount}" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="christmasStar3D">
            <feDropShadow dx="1" dy="2" stdDeviation="1" flood-color="rgba(0,0,0,0.3)"/>
          </filter>
        </defs>
        <polygon 
          points="50,8 61,38 95,38 68,58 78,90 50,72 22,90 32,58 5,38 39,38" 
          fill="url(#christmasStarGrad)" 
          stroke="${isFavorited ? '#FFF8DC' : '#6B5A00'}" 
          stroke-width="1.5"
          filter="url(#christmasStarGlow)"
          style="opacity: ${isFavorited ? '1' : '0.7'};"
        />
        <polygon 
          points="50,15 58,36 78,36 62,50 68,72 50,60 32,72 38,50 22,36 42,36" 
          fill="rgba(255,255,255,${isFavorited ? '0.3' : '0.1'})" 
          filter="url(#christmasStar3D)"
        />
      </svg>
    `;
  }
  
  /**
   * 创建礼物图片底部按钮
   */
  static createBottomGifts(): string {
    const giftsUrl = getExtensionUrl('icons/christmas/gifts.png');
    return `<img src="${giftsUrl}" style="width: 36px; height: 28px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" alt="收藏">`;
  }
  
  /**
   * 获取圣诞树主干样式
   */
  static getTimelineBarStyle(): string {
    return `
      background: linear-gradient(
        180deg,
        rgba(87, 223, 137, 0.74) 0%,
        rgba(43, 194, 53, 0.77) 40%,
        rgb(19, 99, 36) 100%
      );
      width: 4px;
      border-radius: 4px;
      box-shadow:
        0 0 3px rgba(96, 94, 94, 0.5),
        inset 0 0 2px rgba(255, 255, 255, 0.25);
    `;
  }
  
  /**
   * 销毁效果
   */
  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.meteorInterval) {
      clearInterval(this.meteorInterval);
    }
    this.particleCanvas?.remove();
    this.particles = [];
  }
}

/**
 * 科幻主题效果管理器
 */
export class SciFiThemeEffects {
  private container: HTMLElement;
  private fluidElement: HTMLElement | null = null;
  private matrixCanvas: HTMLCanvasElement | null = null;
  private matrixCtx: CanvasRenderingContext2D | null = null;
  private matrixAnimationId: number | null = null;
  private matrixChars: Array<{x: number; y: number; char: string; speed: number; opacity: number}> = [];
  
  // 科技蓝色
  static readonly TECH_BLUE = '#00A8FF';
  static readonly TECH_BLUE_GLOW = 'rgba(0, 168, 255, 0.6)';
  
  constructor(container: HTMLElement) {
    this.container = container;
  }
  
  /**
   * 初始化科幻主题效果
   */
  init(): void {
    this.createFluidBar();
    this.createMatrixCanvas();
    this.startMatrixAnimation();
  }
  
  /**
   * 创建淡紫色流体树干效果
   */
  private createFluidBar(): void {
    this.fluidElement = document.createElement('div');
    this.fluidElement.className = 'scifi-fluid-bar';
    
    Object.assign(this.fluidElement.style, {
      position: 'absolute',
      left: '50%',
      top: '0',
      width: '4px',
      height: '100%',
      transform: 'translateX(-50%)',
      background: 'linear-gradient(180deg, rgba(180, 150, 220, 0.6) 0%, rgba(150, 120, 200, 0.7) 25%, rgba(170, 140, 210, 0.6) 50%, rgba(150, 120, 200, 0.7) 75%, rgba(180, 150, 220, 0.6) 100%)',
      backgroundSize: '100% 200%',
      animation: 'scifiFluidFlow 4s ease-in-out infinite',
      borderRadius: '2px',
      boxShadow: '0 0 10px rgba(180, 150, 220, 0.4), 0 0 20px rgba(180, 150, 220, 0.2)',
      zIndex: '0',
      pointerEvents: 'none'
    });
    
    this.container.insertBefore(this.fluidElement, this.container.firstChild);
  }
  
  /**
   * 创建矩阵字符画布
   */
  private createMatrixCanvas(): void {
    this.matrixCanvas = document.createElement('canvas');
    this.matrixCanvas.className = 'scifi-matrix-canvas';
    Object.assign(this.matrixCanvas.style, {
      position: 'absolute',
      top: '0',
      left: '-25px',
      width: '90px',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '0'
    });
    
    this.matrixCanvas.width = 90;
    this.matrixCanvas.height = this.container.clientHeight || 800;
    this.matrixCtx = this.matrixCanvas.getContext('2d');
    this.container.appendChild(this.matrixCanvas);
  }
  
  /**
   * 开始矩阵字符动画
   */
  private startMatrixAnimation(): void {
    // 可用的乱码字符
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    
    // 定时添加新字符
    setInterval(() => {
      if (this.matrixChars.length < 15 && Math.random() < 0.3) {
        const canvasWidth = this.matrixCanvas?.width || 90;
        this.matrixChars.push({
          x: Math.random() * canvasWidth,
          y: -15,
          char: chars[Math.floor(Math.random() * chars.length)],
          speed: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.5 + 0.3
        });
      }
    }, 800);
    
    this.animateMatrix();
  }
  
  /**
   * 矩阵动画循环
   */
  private animateMatrix = (): void => {
    if (!this.matrixCtx || !this.matrixCanvas) return;
    
    const ctx = this.matrixCtx;
    const width = this.matrixCanvas.width;
    const height = this.matrixCanvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    this.matrixChars = this.matrixChars.filter(c => {
      c.y += c.speed;
      
      if (c.y > height + 20) return false;
      
      ctx.font = '12px monospace';
      ctx.fillStyle = `rgba(0, 168, 255, ${c.opacity})`;
      ctx.shadowColor = SciFiThemeEffects.TECH_BLUE;
      ctx.shadowBlur = 3;
      ctx.fillText(c.char, c.x, c.y);
      
      return true;
    });
    
    this.matrixAnimationId = requestAnimationFrame(this.animateMatrix);
  };
  
  /**
   * 创建骷髅头顶部按钮
   * 未点击时蓝色，点击后红色
   */
  static createTopSkull(isFavorited: boolean): string {
    const color = isFavorited ? '#FF4444' : SciFiThemeEffects.TECH_BLUE;
    const glowColor = isFavorited ? 'rgba(255, 68, 68, 0.6)' : SciFiThemeEffects.TECH_BLUE_GLOW;
    const glowIntensity = isFavorited ? '8px' : '5px';
    
    return `
      <svg width="28" height="28" viewBox="0 0 100 100" style="filter: drop-shadow(0 0 ${glowIntensity} ${glowColor});">
        <!-- 骷髅头轮廓 -->
        <ellipse cx="50" cy="42" rx="38" ry="35" fill="none" stroke="${color}" stroke-width="3"/>
        <!-- 左眼眶 -->
        <ellipse cx="35" cy="40" rx="10" ry="12" fill="${color}"/>
        <!-- 右眼眶 -->
        <ellipse cx="65" cy="40" rx="10" ry="12" fill="${color}"/>
        <!-- 鼻子 -->
        <path d="M 50 52 L 45 62 L 55 62 Z" fill="${color}"/>
        <!-- 下颚 -->
        <path d="M 25 65 Q 50 85 75 65" fill="none" stroke="${color}" stroke-width="3"/>
        <!-- 牙齿 -->
        <line x1="35" y1="68" x2="35" y2="78" stroke="${color}" stroke-width="2"/>
        <line x1="45" y1="70" x2="45" y2="82" stroke="${color}" stroke-width="2"/>
        <line x1="55" y1="70" x2="55" y2="82" stroke="${color}" stroke-width="2"/>
        <line x1="65" y1="68" x2="65" y2="78" stroke="${color}" stroke-width="2"/>
      </svg>
    `;
  }
  
  /**
   * 获取树干流体样式
   */
  static getTimelineBarStyle(): string {
    return `
      background: linear-gradient(180deg, 
        rgba(180, 150, 220, 0.6) 0%, 
        rgba(150, 120, 200, 0.7) 25%, 
        rgba(170, 140, 210, 0.6) 50%, 
        rgba(150, 120, 200, 0.7) 75%, 
        rgba(180, 150, 220, 0.6) 100%
      );
      background-size: 100% 200%;
      animation: scifiFluidFlow 4s ease-in-out infinite;
      box-shadow: 0 0 10px rgba(180, 150, 220, 0.4), 0 0 20px rgba(180, 150, 220, 0.2);
      width: 4px;
      border-radius: 2px;
    `;
  }
  
  /**
   * 创建底部 Love Death Robots 静态显示
   * 静态显示一个 love death robot
   */
  static createLDRBottom(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ldr-loader';
    
    Object.assign(container.style, {
      display: 'flex',
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '4px',
      height: '32px',
      width: '55px'
    });
    
    // Love - 心形
    const love = document.createElement('div');
    Object.assign(love.style, {
      background: 'red',
      display: 'flex',
      width: '12px',
      height: '12px',
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      transform: 'rotate(45deg)',
      boxShadow: '0 0 6px rgba(255, 0, 0, 0.5)'
    });
    
    const loveBefore = document.createElement('div');
    Object.assign(loveBefore.style, {
      position: 'absolute',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      background: 'red',
      left: '-6px'
    });
    
    const loveAfter = document.createElement('div');
    Object.assign(loveAfter.style, {
      position: 'absolute',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      background: 'red',
      top: '-6px'
    });
    
    love.appendChild(loveBefore);
    love.appendChild(loveAfter);
    
    // Death - X形
    const death = document.createElement('div');
    Object.assign(death.style, {
      display: 'flex',
      width: '18px',
      height: '18px',
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center'
    });
    
    const deathLine1 = document.createElement('div');
    Object.assign(deathLine1.style, {
      position: 'absolute',
      height: '20px',
      borderLeft: '4px solid red',
      transform: 'rotate(45deg)',
      borderRadius: '3px',
      boxShadow: '0 0 4px rgba(255, 0, 0, 0.5)'
    });
    
    const deathLine2 = document.createElement('div');
    Object.assign(deathLine2.style, {
      position: 'absolute',
      height: '20px',
      borderLeft: '4px solid red',
      transform: 'rotate(-45deg)',
      borderRadius: '3px',
      boxShadow: '0 0 4px rgba(255, 0, 0, 0.5)'
    });
    
    death.appendChild(deathLine1);
    death.appendChild(deathLine2);
    
    // Robots - 机器人方块
    const robots = document.createElement('div');
    Object.assign(robots.style, {
      display: 'flex',
      width: '16px',
      height: '16px',
      justifyContent: 'space-between',
      backgroundColor: '#ff0000',
      borderRadius: '0 4px 4px 0',
      padding: '3px',
      alignItems: 'center',
      boxShadow: '0 0 6px rgba(255, 0, 0, 0.5)'
    });
    
    const eye1 = document.createElement('div');
    Object.assign(eye1.style, {
      width: '4px',
      height: '4px',
      backgroundColor: '#ffffff',
      borderRadius: '50%'
    });
    
    const eye2 = document.createElement('div');
    Object.assign(eye2.style, {
      width: '4px',
      height: '4px',
      backgroundColor: '#ffffff',
      borderRadius: '50%'
    });
    
    robots.appendChild(eye1);
    robots.appendChild(eye2);
    
    container.appendChild(love);
    container.appendChild(death);
    container.appendChild(robots);
    
    return container;
  }
  
  /**
   * 销毁效果
   */
  destroy(): void {
    if (this.matrixAnimationId) {
      cancelAnimationFrame(this.matrixAnimationId);
    }
    this.fluidElement?.remove();
    this.matrixCanvas?.remove();
    this.matrixChars = [];
  }
}

/**
 * 注入全局主题动画样式
 */
export function injectThemeAnimationStyles(): void {
  const styleId = 'llm-theme-effects-styles';
  
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) {
    existingStyle.remove();
  }
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* ========== 圣诞主题节点样式 ========== */
    .christmas-node-sphere {
      border-radius: 50%;
      position: relative;
      overflow: visible;
    }
    
    .christmas-node-default {
      background: radial-gradient(circle at 30% 30%, #E8C860 0%, #C9A830 50%, #A08020 100%);
      box-shadow: 
        inset -2px -2px 4px rgba(0,0,0,0.3),
        inset 2px 2px 4px rgba(255,255,255,0.2),
        0 2px 4px rgba(0,0,0,0.3);
    }
    
    .christmas-node-active {
      background: radial-gradient(circle at 30% 30%, #FFF8DC 0%, #FFD700 40%, #DAA520 100%);
      box-shadow: 
        inset -2px -2px 4px rgba(0,0,0,0.2),
        inset 2px 2px 6px rgba(255,255,255,0.4),
        0 0 15px rgba(255, 215, 0, 0.6),
        0 2px 6px rgba(0,0,0,0.3);
    }
    
    .christmas-node-pinned {
      background: radial-gradient(circle at 30% 30%, #FF6B6B 0%, #E53935 50%, #B71C1C 100%);
      box-shadow: 
        inset -2px -2px 4px rgba(0,0,0,0.3),
        inset 2px 2px 4px rgba(255,255,255,0.3),
        0 0 12px rgba(229, 57, 53, 0.5),
        0 2px 5px rgba(0,0,0,0.3);
    }
    
    /* 标记且激活 - 红色更亮 */
    .christmas-node-pinned-active {
      background: radial-gradient(circle at 30% 30%, #FF8A80 0%, #FF5252 50%, #D32F2F 100%);
      box-shadow: 
        inset -2px -2px 4px rgba(0,0,0,0.2),
        inset 2px 2px 6px rgba(255,255,255,0.4),
        0 0 18px rgba(255, 82, 82, 0.7),
        0 2px 6px rgba(0,0,0,0.3);
    }
    
    /* ========== 科幻主题节点样式 - 单环 ========== */
    .scifi-single-ring {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .scifi-ring {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      box-sizing: border-box;
    }
    
    /* 科幻主题动画 */
    @keyframes scifiRingRotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    @keyframes scifiFluidFlow {
      0%, 100% { background-position: 0% 0%; }
      50% { background-position: 0% 100%; }
    }
    
    /* LDR 动画 - 按用户提供的CSS */
    @keyframes ldrScrollUp {
      0% { transform: translateY(0); filter: blur(0); }
      30% { transform: translateY(-150%); filter: blur(10px); }
      60% { transform: translateY(0); filter: blur(0px); }
    }
    
    @keyframes ldrScrollDown {
      0% { transform: translateY(0); filter: blur(0); }
      30% { transform: translateY(150%); filter: blur(10px); }
      60% { transform: translateY(0); filter: blur(0px); }
    }
    
    /* 圣诞主题 Tooltip 样式 */
    .christmas-tooltip {
      background: linear-gradient(135deg, #FFFAF0 0%, #FFF8DC 100%) !important;
      border: 1px solid #DAA520 !important;
      color: #8B4513 !important;
    }
    
    /* 科幻主题 Tooltip 样式 - 淡色适配主题 */
    .scifi-tooltip {
      background: linear-gradient(
        135deg,
        rgba(70, 65, 95, 0.85) 0%,
        rgba(85, 80, 110, 0.85) 100%
      ) !important;
      border: 1px solid rgba(0, 168, 255, 0.5) !important;
      color: #B8D4FF !important;
      text-shadow: 0 0 3px rgba(0, 168, 255, 0.3);
    }
  `;
  
  document.head.appendChild(style);
}
