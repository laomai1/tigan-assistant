// 应用状态
let state = {
    isRunning: false,
    isPaused: false,
    currentTime: 60,
    totalRounds: 0,
    totalSeconds: 0,
    isContracting: true, // true: 提肛, false: 放松
    timer: null,
    currentCycle: 0,
    totalCycles: 0
};

// DOM 元素
const elements = {
    timeDisplay: document.querySelector('.time'),
    actionText: document.querySelector('.action-text'),
    progressFill: document.querySelector('.progress-fill'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    resetBtn: document.getElementById('resetBtn'),
    roundCount: document.getElementById('roundCount'),
    totalTime: document.getElementById('totalTime'),
    newsContainer: document.getElementById('newsContainer'),
    contractTime: document.getElementById('contractTime'),
    relaxTime: document.getElementById('relaxTime'),
    voiceEnabled: document.getElementById('voiceEnabled'),
    musicEnabled: document.getElementById('musicEnabled'),
    musicVolume: document.getElementById('musicVolume'),
    volumeValue: document.getElementById('volumeValue')
};

// 背景音乐管理
const bgMusic = {
    context: null,
    oscillators: [],
    gainNodes: [],
    isPlaying: false,
    melodyInterval: null,
    
    // 初始化音频上下文
    init() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    
    // 播放流行轻音乐（使用Web Audio API生成）
    play() {
        if (this.isPlaying || !elements.musicEnabled.checked) return;
        
        this.init();
        
        // 流行音乐和弦进行 (C-Am-F-G)
        const chordProgressions = [
            [261.63, 329.63, 392.00],  // C大三和弦 (C-E-G)
            [220.00, 261.63, 329.63],  // Am小三和弦 (A-C-E)
            [174.61, 220.00, 261.63],  // F大三和弦 (F-A-C)
            [196.00, 246.94, 293.66]   // G大三和弦 (G-B-D)
        ];
        
        // 旋律音符序列（流行风格）
        const melodyNotes = [
            523.25, 587.33, 659.25, 587.33,  // C5-D5-E5-D5
            523.25, 440.00, 523.25, 587.33,  // C5-A4-C5-D5
            659.25, 587.33, 523.25, 440.00,  // E5-D5-C5-A4
            392.00, 440.00, 523.25, 392.00   // G4-A4-C5-G4
        ];
        
        let chordIndex = 0;
        let melodyIndex = 0;
        
        // 创建和弦音（背景和声）
        const playChord = () => {
            // 清除之前的振荡器
            this.oscillators.forEach(osc => {
                try { osc.stop(); osc.disconnect(); } catch(e) {}
            });
            this.oscillators = [];
            this.gainNodes = [];
            
            const chord = chordProgressions[chordIndex % chordProgressions.length];
            
            // 为和弦的每个音创建振荡器
            chord.forEach((freq, i) => {
                const oscillator = this.context.createOscillator();
                const gainNode = this.context.createGain();
                
                // 使用三角波，音色更柔和
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(freq, this.context.currentTime);
                
                // 和弦音量较低，作为背景
                const baseVolume = elements.musicVolume.value / 100 * 0.03;
                gainNode.gain.setValueAtTime(baseVolume, this.context.currentTime);
                
                oscillator.connect(gainNode);
                gainNode.connect(this.context.destination);
                
                oscillator.start();
                
                this.oscillators.push(oscillator);
                this.gainNodes.push(gainNode);
            });
            
            chordIndex++;
        };
        
        // 创建旋律音（主旋律）
        const playMelody = () => {
            const oscillator = this.context.createOscillator();
            const gainNode = this.context.createGain();
            
            // 使用正弦波作为旋律，音色清晰
            oscillator.type = 'sine';
            const freq = melodyNotes[melodyIndex % melodyNotes.length];
            oscillator.frequency.setValueAtTime(freq, this.context.currentTime);
            
            // 旋律音量
            const volume = elements.musicVolume.value / 100 * 0.08;
            gainNode.gain.setValueAtTime(volume, this.context.currentTime);
            
            // 添加音符的淡入淡出效果
            gainNode.gain.exponentialRampToValueAtTime(volume, this.context.currentTime + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.45);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.context.destination);
            
            oscillator.start();
            oscillator.stop(this.context.currentTime + 0.5);
            
            melodyIndex++;
        };
        
        // 开始播放
        playChord();
        
        // 每4秒切换和弦
        const chordInterval = setInterval(() => {
            if (this.isPlaying) {
                playChord();
            } else {
                clearInterval(chordInterval);
            }
        }, 4000);
        
        // 每0.5秒播放一个旋律音符
        this.melodyInterval = setInterval(() => {
            if (this.isPlaying) {
                playMelody();
            } else {
                clearInterval(this.melodyInterval);
            }
        }, 500);
        
        this.isPlaying = true;
    },
    
    // 停止音乐
    stop() {
        if (this.isPlaying) {
            this.oscillators.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch(e) {}
            });
            this.oscillators = [];
            this.gainNodes = [];
            
            if (this.melodyInterval) {
                clearInterval(this.melodyInterval);
                this.melodyInterval = null;
            }
            
            this.isPlaying = false;
        }
    },
    
    // 设置音量
    setVolume(volume) {
        // 更新所有当前播放的和弦音量
        this.gainNodes.forEach(gainNode => {
            if (gainNode) {
                const baseVolume = volume * 0.03;
                gainNode.gain.setValueAtTime(baseVolume, this.context.currentTime);
            }
        });
    }
};

// 初始化
function init() {
    loadNews();
    setupEventListeners();
    calculateCycles();
    
    // 初始化背景音乐
    bgMusic.init();
}

// 计算一轮60秒内的循环次数
function calculateCycles() {
    const contractTime = parseInt(elements.contractTime.value);
    const relaxTime = parseInt(elements.relaxTime.value);
    const cycleTime = contractTime + relaxTime;
    state.totalCycles = Math.floor(60 / cycleTime);
    
    // 如果不能整除，调整最后一个周期
    if (60 % cycleTime !== 0) {
        state.totalCycles += 1;
    }
}

// 设置事件监听
function setupEventListeners() {
    elements.startBtn.addEventListener('click', startExercise);
    elements.pauseBtn.addEventListener('click', pauseExercise);
    elements.resetBtn.addEventListener('click', resetExercise);
    
    elements.contractTime.addEventListener('change', calculateCycles);
    elements.relaxTime.addEventListener('change', calculateCycles);
    
    // 音乐控制
    elements.musicEnabled.addEventListener('change', () => {
        if (elements.musicEnabled.checked && state.isRunning) {
            bgMusic.play();
        } else {
            bgMusic.stop();
        }
    });
    
    elements.musicVolume.addEventListener('input', (e) => {
        const volume = e.target.value;
        elements.volumeValue.textContent = volume + '%';
        bgMusic.setVolume(volume / 100);
    });
}

// 开始训练
function startExercise() {
    if (!state.isRunning) {
        state.isRunning = true;
        state.currentTime = 60;
        state.currentCycle = 0;
        state.isContracting = true;
        
        elements.startBtn.style.display = 'none';
        elements.pauseBtn.style.display = 'block';
        
        // 播放背景音乐
        bgMusic.play();
        
        speak('开始训练，准备提肛');
        runExercise();
    } else if (state.isPaused) {
        state.isPaused = false;
        elements.pauseBtn.textContent = '暂停';
        
        // 恢复音乐
        if (!bgMusic.isPlaying) {
            bgMusic.play();
        }
        
        runExercise();
    }
}

// 暂停训练
function pauseExercise() {
    if (state.isRunning && !state.isPaused) {
        state.isPaused = true;
        elements.pauseBtn.textContent = '继续';
        clearInterval(state.timer);
        
        // 暂停音乐
        bgMusic.stop();
    } else {
        startExercise();
    }
}

// 重置训练
function resetExercise() {
    state.isRunning = false;
    state.isPaused = false;
    state.currentTime = 60;
    state.currentCycle = 0;
    
    clearInterval(state.timer);
    
    // 停止音乐
    bgMusic.stop();
    
    elements.timeDisplay.textContent = '60';
    elements.actionText.textContent = '准备开始';
    elements.progressFill.style.width = '0%';
    elements.startBtn.style.display = 'block';
    elements.pauseBtn.style.display = 'none';
    elements.pauseBtn.textContent = '暂停';
}

// 运行训练循环
function runExercise() {
    const contractTime = parseInt(elements.contractTime.value);
    const relaxTime = parseInt(elements.relaxTime.value);
    let cycleTimer = 0;
    
    state.timer = setInterval(() => {
        if (state.currentTime > 0) {
            state.currentTime--;
            state.totalSeconds++;
            cycleTimer++;
            
            // 更新显示
            elements.timeDisplay.textContent = state.currentTime;
            const progress = ((60 - state.currentTime) / 60) * 100;
            elements.progressFill.style.width = progress + '%';
            
            // 判断当前应该是提肛还是放松
            if (state.isContracting) {
                elements.actionText.textContent = `💪 提肛坚持 ${contractTime - (cycleTimer % (contractTime + relaxTime))} 秒`;
                
                if (cycleTimer % (contractTime + relaxTime) === contractTime) {
                    state.isContracting = false;
                    cycleTimer = 0;
                    speak('放松');
                }
            } else {
                const remainingRelax = relaxTime - (cycleTimer % (contractTime + relaxTime));
                elements.actionText.textContent = `😌 放松 ${remainingRelax} 秒`;
                
                if (cycleTimer % (contractTime + relaxTime) === relaxTime) {
                    state.isContracting = true;
                    cycleTimer = 0;
                    state.currentCycle++;
                    
                    if (state.currentTime > 0) {
                        speak('提肛');
                    }
                }
            }
            
            // 更新总时长
            elements.totalTime.textContent = Math.floor(state.totalSeconds / 60);
            
        } else {
            // 一轮完成
            completeRound();
        }
    }, 1000);
}

// 完成一轮
function completeRound() {
    clearInterval(state.timer);
    state.totalRounds++;
    state.isRunning = false;
    
    // 停止音乐
    bgMusic.stop();
    
    elements.roundCount.textContent = state.totalRounds;
    elements.actionText.textContent = '🎉 本轮完成！';
    elements.startBtn.style.display = 'block';
    elements.pauseBtn.style.display = 'none';
    
    speak('一轮训练完成，休息一下吧');
    
    // 重置为初始状态
    setTimeout(() => {
        state.currentTime = 60;
        elements.timeDisplay.textContent = '60';
        elements.progressFill.style.width = '0%';
        elements.actionText.textContent = '准备开始下一轮';
    }, 3000);
}

// 语音提示
function speak(text) {
    if (!elements.voiceEnabled.checked) return;
    
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 1;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
    }
}

// 加载新闻
async function loadNews() {
    try {
        // 使用聚合新闻API获取实时新闻
        const response = await fetch('https://apis.tianapi.com/generalnews/index?key=free&num=20');
        const data = await response.json();
        
        if (data.code === 200 && data.result && data.result.newslist) {
            const newsArray = data.result.newslist.map(item => ({
                title: item.title,
                description: item.description || item.content || '暂无简介',
                time: formatTime(item.ctime),
                url: item.url || item.mobileurl || 'https://www.toutiao.com/'
            }));
            displayNews(newsArray);
        } else {
            // 如果API失败，尝试备用源
            loadBackupNews();
        }
        
    } catch (error) {
        console.log('主新闻源加载失败，使用备用新闻源');
        loadBackupNews();
    }
}

// 备用新闻加载
async function loadBackupNews() {
    try {
        // 使用免费新闻API
        const response = await fetch('https://v2.alapi.cn/api/toutiao/new?num=20');
        const data = await response.json();
        
        if (data.code === 200 && data.data && data.data.length > 0) {
            const newsArray = data.data.map(item => ({
                title: item.title,
                description: item.description || item.abstract || '点击查看详情',
                time: formatTime(item.time),
                url: item.url || 'https://www.toutiao.com/'
            }));
            displayNews(newsArray);
        } else {
            // 最后备用：使用模拟数据
            useMockNews();
        }
    } catch (error) {
        useMockNews();
    }
}

// 使用模拟新闻数据
function useMockNews() {
    const mockNews = [
        { 
            title: '科技创新引领未来发展 人工智能技术取得重大突破', 
            description: '近日，多家科技企业在人工智能领域取得重大进展，新一代AI模型在自然语言处理、图像识别等方面表现出色，为各行业数字化转型提供强大支持。',
            time: '1小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '全球经济形势持续向好 市场信心不断增强', 
            description: '最新经济数据显示，全球主要经济体增长势头良好，贸易往来日益频繁，投资者信心指数创新高，为世界经济复苏注入强劲动力。',
            time: '2小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '健康生活方式成为新趋势 运动健身受到广泛关注', 
            description: '越来越多的人开始重视健康管理，定期运动、均衡饮食、规律作息成为新的生活方式。专家建议每天至少运动30分钟，保持身心健康。',
            time: '3小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '体育快讯：运动锻炼有益身心健康 提升生活质量', 
            description: '最新研究表明，规律的体育锻炼不仅能增强体质，还能有效缓解压力、改善睡眠质量。专家推荐结合有氧运动和力量训练，效果更佳。',
            time: '4小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '文化产业蓬勃发展 数字文化消费成新亮点', 
            description: '随着数字技术的普及，在线观影、云端展览、虚拟演出等新型文化消费形式快速发展，为文化产业注入新活力，满足人们多元化的精神需求。',
            time: '5小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '市场活力持续增强 消费升级趋势明显', 
            description: '数据显示，消费市场呈现稳步增长态势，高品质商品和服务需求旺盛，新零售模式蓬勃发展，为经济增长提供有力支撑。',
            time: '6小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '教育改革深入推进 素质教育理念深入人心', 
            description: '教育部门持续推进教育改革，注重培养学生创新能力和实践能力，减轻课业负担，促进学生全面发展，家长和社会各界反响积极。',
            time: '7小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '环保意识日益增强 绿色发展成为共识', 
            description: '越来越多的企业和个人开始践行绿色发展理念，节能减排、垃圾分类、绿色出行等环保行动蔚然成风，为建设美丽家园贡献力量。',
            time: '8小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '医疗技术不断进步 智慧医疗服务更便捷', 
            description: '互联网+医疗健康快速发展，在线问诊、远程会诊、智能诊断等服务日益完善，让患者享受更加便捷高效的医疗服务，就医体验持续提升。',
            time: '9小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '交通基础设施建设加快 出行更加便利', 
            description: '高速铁路、城市轨道交通等项目建设进展顺利，交通网络日益完善，大大缩短了城市间的时空距离，为经济社会发展提供有力保障。',
            time: '10小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '数字经济蓬勃发展 新业态新模式不断涌现', 
            description: '电子商务、在线教育、远程办公等数字经济业态快速发展，成为经济增长新引擎。5G、云计算、大数据等技术应用不断深化。',
            time: '11小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '社区服务水平提升 居民幸福感增强', 
            description: '各地社区积极完善服务设施，丰富文化活动，提供养老托幼等便民服务，打造温馨和谐的社区环境，居民满意度显著提高。',
            time: '12小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '科研创新成果丰硕 核心技术突破加快', 
            description: '科研团队在基础研究和应用研究领域取得多项重要成果，关键核心技术攻关不断突破，为高质量发展提供科技支撑。',
            time: '13小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '乡村振兴战略深入实施 农村面貌焕然一新', 
            description: '美丽乡村建设成效显著，农业产业化水平提升，农民收入持续增长，基础设施不断完善，乡村旅游等新产业蓬勃发展。',
            time: '14小时前', 
            url: 'https://www.toutiao.com/' 
        },
        { 
            title: '就业形势总体稳定 创业创新活力涌现', 
            description: '各项就业政策落实有力，新增就业岗位稳步增长，灵活就业、自主创业成为新趋势，为经济社会发展注入活力。',
            time: '15小时前', 
            url: 'https://www.toutiao.com/' 
        }
    ];
    displayNews(mockNews);
}

// 格式化时间
function formatTime(timestamp) {
    if (!timestamp) return '刚刚';
    
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    
    if (diff < minute) {
        return '刚刚';
    } else if (diff < hour) {
        return Math.floor(diff / minute) + '分钟前';
    } else if (diff < day) {
        return Math.floor(diff / hour) + '小时前';
    } else {
        return Math.floor(diff / day) + '天前';
    }
}

// 显示新闻
function displayNews(newsArray) {
    if (!newsArray || newsArray.length === 0) {
        elements.newsContainer.innerHTML = '<div class="loading">暂无新闻</div>';
        return;
    }
    
    const newsHTML = newsArray.map(news => `
        <div class="news-item" onclick="window.open('${news.url || 'https://www.toutiao.com/'}', '_blank')">
            <div class="news-title">${news.title}</div>
            <div class="news-description">${news.description || ''}</div>
            <div class="news-time">${news.time}</div>
        </div>
    `).join('');
    
    elements.newsContainer.innerHTML = newsHTML;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 添加页面可见性变化监听，防止后台运行时计时不准
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isRunning && !state.isPaused) {
        pauseExercise();
    }
});
