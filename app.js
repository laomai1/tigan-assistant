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
    // 2025年11月24日最新新闻（生活、民生类）
    const newsData = [
        {
            title: '全国多地迎来降温 南方罕见11月降雪',
            description: '受强冷空气影响,今日全国大部分地区气温骤降8-12℃。湖南、江西等南方城市出现罕见的11月降雪,市民纷纷晒出雪景照片。气象部门提醒做好防寒保暖工作。',
            time: '11月24日',
            url: 'https://news.163.com/'
        },
        {
            title: '咖啡品牌"幸运咖"推出AI调制个性化饮品 年轻人热捧',
            description: '新锐咖啡品牌"幸运咖"在上海、北京等地门店引入AI调制系统,根据顾客口味偏好和情绪状态推荐定制饮品。开业首日排队超3小时,成为社交媒体热门打卡地。',
            time: '11月24日',
            url: 'https://money.163.com/'
        },
        {
            title: '上海地铁试行"静音车厢" 乘客点赞文明出行',
            description: '上海地铁2号线今日试点推出"静音车厢",车厢内禁止外放音视频、大声通话。乘客普遍支持,称能安静休息或看书。计划12月起在更多线路推广。',
            time: '11月24日',
            url: 'https://news.163.com/'
        },
        {
            title: '00后小伙辞职卖烤红薯年入50万 分享创业经验走红',
            description: '24岁的杭州小伙辞去互联网工作,在夜市卖烤红薯。凭借精选品种和独特烤制技巧,每天营业额超3000元。他在社交平台分享创业心得,获百万点赞。',
            time: '11月24日',
            url: 'https://money.163.com/'
        },
        {
            title: '年轻人流行"周五下班即旅行" 高铁周末游成新趋势',
            description: '越来越多上班族选择周五下班直奔高铁站,开启48小时微旅行。苏州、杭州、南京等周边城市成热门目的地。旅游平台数据显示,周末游订单量同比增长40%。',
            time: '11月24日',
            url: 'https://travel.163.com/'
        },
        {
            title: '养老金调整政策公布 退休人员明年人均增加180元',
            description: '人社部发布2026年养老金调整方案,企业退休人员养老金平均上调5.2%,惠及1.3亿人。北京、上海等地同步公布具体实施细则,预计明年1月发放到位。',
            time: '11月24日',
            url: 'https://money.163.com/'
        },
        {
            title: '宠物友好商场开业 可带宠物逛街引关注',
            description: '深圳首家宠物友好商场今日开业,允许顾客携带宠物入内,设有宠物休息区、饮水站等设施。开业当天吸引数百位宠物主人,场面温馨热闹。',
            time: '11月24日',
            url: 'https://news.163.com/'
        },
        {
            title: '外卖骑手自创"避堵路线图"走红 网友:民间高手',
            description: '北京外卖骑手老王自制城区避堵路线图,标注各时段拥堵路段和快速通道。他将经验分享到网上,帮助同行提高效率,被网友称为"送餐界活地图"。',
            time: '11月24日',
            url: 'https://news.163.com/'
        },
        {
            title: '小区健身角配"智能教练" 居民运动更科学',
            description: '成都某小区引入AI健身系统,居民扫码即可获得专业运动指导和健康建议。62岁的李阿姨说,有了智能教练纠正动作,锻炼更安全有效,邻居们都爱来。',
            time: '11月24日',
            url: 'https://news.163.com/'
        },
        {
            title: '多地菜价回落 "菜篮子"更实惠了',
            description: '随着冬季蔬菜大量上市，全国多地菜价明显回落。市民表示，青菜、白菜等常见蔬菜价格降了近三成，买菜不用再心疼钱包了，生活成本明显下降。',
            time: '11月24日',
            url: 'https://news.163.com/'
        },
        {
            title: '快递包装回收新规实施 绿色物流成趋势',
            description: '多家快递公司今日启动包装回收计划,消费者可在快递站点回收纸箱获得积分奖励。环保部门数据显示,此举预计每年可减少包装垃圾20万吨。',
            time: '11月24日',
            url: 'https://news.163.com/'
        },
        {
            title: '社区开设老年人智能手机课堂 报名火爆',
            description: '广州多个社区开设免费智能手机培训班,教老年人使用微信、打车、网购等功能。73岁的王大爷说,学会后生活方便多了,还能跟孙子视频聊天。',
            time: '11月24日',
            url: 'https://news.163.com/'
        },
        {
            title: '新能源汽车充电桩覆盖率提升 "充电焦虑"缓解',
            description: '国家电网数据显示,全国公共充电桩数量已突破200万个,高速服务区充电站覆盖率达95%。新能源车主表示,充电越来越方便,长途出行无忧。',
            time: '11月24日',
            url: 'https://auto.163.com/'
        },
        {
            title: '城市图书馆推出"24小时自助借阅" 夜间也能借书',
            description: '北京、上海等地图书馆增设24小时自助借阅区,读者可随时借还图书。夜班工作者小张说,下班后还能来借书,真正实现了全天候阅读。',
            time: '11月24日',
            url: 'https://news.163.com/'
        },
        {
            title: '社区食堂推出"一人份套餐" 独居老人吃饭不再难',
            description: '杭州多个社区食堂推出适合老年人的营养套餐,价格实惠分量适中。独居老人李奶奶说,有了社区食堂,每天吃饭营养又方便,不用自己做了。',
            time: '11月24日',
            url: 'https://news.163.com/'
        }
    ];
    
    displayNews(newsData);
}

// 最终备用方案
function loadFallbackNews() {
    // 显示今日日期的提示
    const today = new Date();
    const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
    
    elements.newsContainer.innerHTML = `
        <div class="loading">
            📰 ${dateStr}<br><br>
            暂时无法加载实时资讯。<br><br>
            推荐访问：<br>
            <a href="https://news.163.com/" target="_blank" style="color: #000; text-decoration: underline; display: block; margin: 5px 0;">网易新闻</a>
            <a href="https://www.zhihu.com/hot" target="_blank" style="color: #000; text-decoration: underline; display: block; margin: 5px 0;">知乎热榜</a>
            <a href="https://weibo.com/hot/search" target="_blank" style="color: #000; text-decoration: underline; display: block; margin: 5px 0;">微博热搜</a>
        </div>
    `;
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
