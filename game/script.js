// 二中旮旯给木 · 放学后的约定
// 恋爱视觉小说：主界面 / 存档 / 设置 / 结局鉴赏 / 游戏内菜单。
// 纯前端，无依赖，可直接嵌入 iframe。

(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };

    // ---------- 参数 ----------
    var params = new URLSearchParams(window.location.search);
    var HEROINE = params.get('name') || '操曾希';

    var STORE_KEY = 'heart_vn_endings_v1';
    var SAVE_KEY = 'heart_vn_saves_v1';
    var SETTINGS_KEY = 'heart_vn_settings_v1';
    var START_AFFECTION = 10;
    var MAX_AFFECTION = 86;

    var DEFAULT_SETTINGS = { textSpeed: 24, autoDelay: 1500, bgm: 30, sfx: 70 };

    // ---------- 工具 ----------
    function clampNum(v, min, max) {
        return Math.min(max, Math.max(min, v));
    }

    function toInt(v, def) {
        var n = parseInt(v, 10);
        return isFinite(n) ? n : def;
    }

    function formatTime(ts) {
        var d = new Date(ts || Date.now());
        function p(n) { return (n < 10 ? '0' : '') + n; }
        return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) +
            ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }

    function loadSettings() {
        var s = {};
        try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (e) { s = {}; }
        return {
            textSpeed: clampNum(toInt(s.textSpeed, DEFAULT_SETTINGS.textSpeed), 8, 60),
            autoDelay: clampNum(toInt(s.autoDelay, DEFAULT_SETTINGS.autoDelay), 700, 3000),
            bgm: clampNum(toInt(s.bgm, DEFAULT_SETTINGS.bgm), 0, 100),
            sfx: clampNum(toInt(s.sfx, DEFAULT_SETTINGS.sfx), 0, 100)
        };
    }

    function saveSettings() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
    }

    var settings = loadSettings();

    // ---------- DOM ----------
    var stage = $('stage');
    var portrait = $('portrait');
    var portraitImg = document.querySelector('.portrait-img');
    var namebox = $('namebox');
    var vnText = $('vnText');
    var nextHint = $('nextHint');
    var choicesBox = $('choices');
    var autoBtn = $('autoBtn');
    var skipBtn = $('skipBtn');
    var muteBtn = $('muteBtn');
    var menuBtn = $('menuBtn');
    var logBtn = $('logBtn');
    var affectionNum = $('affectionNum');
    var affDelta = $('affDelta');
    var hpEls = Array.prototype.slice.call(document.querySelectorAll('.hp'));

    var mainMenu = $('mainMenu');
    var menuNew = $('menuNew');
    var menuContinue = $('menuContinue');
    var menuLoad = $('menuLoad');
    var menuSettings = $('menuSettings');
    var menuGallery = $('menuGallery');
    var menuAbout = $('menuAbout');
    var menuEndingBadge = $('menuEndingBadge');
    var menuMuteBtn = $('menuMuteBtn');
    var menuFullBtn = $('menuFullBtn');

    var gameMenu = $('gameMenu');
    var gameMenuClose = $('gameMenuClose');
    var gmResume = $('gmResume');
    var gmSave = $('gmSave');
    var gmLoad = $('gmLoad');
    var gmSettings = $('gmSettings');
    var gmTitle = $('gmTitle');

    var modalOverlay = $('modalOverlay');
    var modalTitle = $('modalTitle');
    var modalBody = $('modalBody');
    var modalClose = $('modalClose');

    var endingOverlay = $('endingOverlay');
    var eLabel = $('eLabel');
    var eTitle = $('eTitle');
    var eDesc = $('eDesc');
    var eAffection = $('eAffection');
    var eEnding = $('eEnding');
    var eUnlocked = $('eUnlocked');
    var playAgainBtn = $('playAgainBtn');
    var toTitleBtn = $('toTitleBtn');

    var chapterCard = $('chapterCard');
    var chapterKicker = $('chapterKicker');
    var chapterSub = $('chapterSub');

    var backlogOverlay = $('backlogOverlay');
    var backlogList = $('backlogList');
    var logClose = $('logClose');

    var toastEl = $('toast');
    var petals = $('petals');
    var splash = $('splash');

    // ---------- 状态 ----------
    var mode = 'menu';
    var affection = START_AFFECTION;
    var finalChoice = null;
    var flags = {};
    var currentBg = 'classroom';
    var currentSpeaker = '';
    var currentChapter = '序章';
    var currentChapterSub = '放学后的教室';
    var slotMode = 'load';

    var story = {
        lines: [],
        labels: {},
        i: -1,
        pending: [],
        done: null,
        typing: false,
        full: '',
        serial: 0,
        auto: false,
        skip: false,
        locked: false,
        chapterActive: false,
        epilogue: false
    };

    var typeTimer = null;
    var autoTimer = null;
    var chapterTimer = null;
    var choiceOpen = false;
    var backlogOpen = false;
    var backlog = [];

    // ---------- 音效 / BGM ----------
    var audio = { ctx: null, muted: false };

    function ensureAudio() {
        if (audio.ctx) {
            if (audio.ctx.state === 'suspended' && audio.ctx.resume) audio.ctx.resume();
            return;
        }
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        try { audio.ctx = new Ctx(); } catch (e) { audio.ctx = null; }
    }

    function tone(freq, dur, type, vol, kind) {
        if (audio.muted) return;
        var mult = (kind === 'bgm' ? settings.bgm : settings.sfx) / 100;
        if (mult <= 0) return;
        ensureAudio();
        if (!audio.ctx) return;
        try {
            var t = audio.ctx.currentTime;
            var osc = audio.ctx.createOscillator();
            var gain = audio.ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime((vol || 0.04) * mult, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
            osc.connect(gain);
            gain.connect(audio.ctx.destination);
            osc.start(t);
            osc.stop(t + (dur || 0.12) + 0.02);
        } catch (e) { /* ignore */ }
    }

    function playSelect() {
        tone(880, 0.07, 'sine', 0.04, 'sfx');
        setTimeout(function () { tone(1174.66, 0.09, 'sine', 0.03, 'sfx'); }, 60);
    }

    function playStartSound() {
        tone(523.25, 0.12, 'sine', 0.04, 'sfx');
        setTimeout(function () { tone(659.25, 0.12, 'sine', 0.04, 'sfx'); }, 120);
        setTimeout(function () { tone(783.99, 0.22, 'sine', 0.04, 'sfx'); }, 240);
    }

    function playAdvanceSound() {
        tone(1180, 0.022, 'square', 0.012, 'sfx');
        setTimeout(function () { tone(760, 0.045, 'sine', 0.022, 'sfx'); }, 24);
    }

    function playEndingSound() {
        tone(523.25, 0.3, 'sine', 0.045, 'sfx');
        setTimeout(function () { tone(659.25, 0.3, 'sine', 0.04, 'sfx'); }, 160);
        setTimeout(function () { tone(783.99, 0.5, 'sine', 0.04, 'sfx'); }, 320);
    }

    var bgm = { timer: null, step: 0 };
    var BGM_CHORDS = [
        [261.63, 329.63, 392.00],
        [220.00, 261.63, 329.63],
        [174.61, 220.00, 261.63],
        [196.00, 246.94, 293.66]
    ];

    function playChord() {
        if (audio.muted) return;
        var chord = BGM_CHORDS[bgm.step % BGM_CHORDS.length];
        bgm.step += 1;
        for (var i = 0; i < chord.length; i++) {
            (function (freq, idx) {
                setTimeout(function () { tone(freq, 2.4, 'sine', 0.014, 'bgm'); }, idx * 110);
            })(chord[i], i);
        }
    }

    function startBgm() {
        if (bgm.timer) return;
        playChord();
        bgm.timer = setInterval(playChord, 3200);
    }

    function stopBgm() {
        clearInterval(bgm.timer);
        bgm.timer = null;
    }

    function applyMuteIcons() {
        var icon = audio.muted ? '🔇' : '🔊';
        muteBtn.textContent = icon;
        menuMuteBtn.textContent = icon;
    }

    function toggleMute() {
        audio.muted = !audio.muted;
        applyMuteIcons();
        if (!audio.muted) ensureAudio();
    }

    muteBtn.addEventListener('click', function (ev) { ev.stopPropagation(); toggleMute(); });
    menuMuteBtn.addEventListener('click', function (ev) { ev.stopPropagation(); toggleMute(); });

    // ---------- 立绘 / 背景 ----------
    var blinkTimer = null;

    var MOOD_IMG = {
        normal: 'heroine.png',
        smile: 'heroine-smile.png',
        happy: 'heroine-smile.png',
        shy: 'heroine-smile.png',
        excited: 'heroine-smile.png',
        sad: 'heroine-sad.png',
        angry: 'heroine-angry.png',
        surprised: 'heroine.png'
    };

    function preloadMoodImages() {
        var list = ['heroine-smile.png', 'heroine-sad.png', 'heroine-angry.png'];
        for (var i = 0; i < list.length; i++) {
            var img = new Image();
            img.src = list[i];
        }
    }

    function setMood(mood) {
        if (portrait.dataset.mood !== mood) portrait.dataset.mood = mood;
        var src = MOOD_IMG[mood] || 'heroine.png';
        if (portraitImg && portraitImg.getAttribute('src') !== src) {
            portraitImg.setAttribute('src', src);
        }
    }

    function startBlinkLoop() {
        clearTimeout(blinkTimer);
        blinkTimer = setTimeout(function () {
            if (!document.hidden && mode === 'story') {
                portrait.dataset.blink = '1';
                setTimeout(function () { portrait.dataset.blink = '0'; }, 120);
            }
            startBlinkLoop();
        }, 3200 + Math.random() * 2600);
    }

    function setBg(name) {
        currentBg = name;
        var list = document.querySelectorAll('.bg');
        for (var i = 0; i < list.length; i++) {
            list[i].classList.toggle('active', list[i].dataset.bg === name);
        }
    }

    function setSpeaker(name) {
        currentSpeaker = name;
        if (name) {
            namebox.textContent = name;
            namebox.classList.remove('hidden');
        } else {
            namebox.classList.add('hidden');
        }
    }

    // ---------- 好感度 ----------
    function updateAffectionMeter() {
        affectionNum.textContent = String(affection);
        var filled = Math.round((affection / MAX_AFFECTION) * 5);
        filled = Math.max(0, Math.min(5, filled));
        for (var i = 0; i < hpEls.length; i++) {
            hpEls[i].classList.toggle('on', i < filled);
        }
    }

    function changeAffection(delta) {
        affection = Math.max(0, Math.min(MAX_AFFECTION, affection + delta));
        updateAffectionMeter();
        affDelta.textContent = (delta > 0 ? '+' : '') + delta;
        affDelta.classList.remove('show');
        void affDelta.offsetWidth;
        affDelta.classList.add('show');
    }

    // ---------- 模式 / 覆盖层 ----------
    function setMode(next) {
        mode = next;
        stage.dataset.mode = next;
        if (next !== 'story') {
            story.auto = false;
            story.skip = false;
            updateToggles();
        }
    }

    function hideOverlays() {
        mainMenu.classList.remove('active');
        endingOverlay.classList.remove('active');
        gameMenu.classList.remove('active');
        modalOverlay.classList.remove('active');
        backlogOverlay.classList.remove('active');
        backlogOpen = false;
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
    }

    function overlayBlocking() {
        return gameMenu.classList.contains('active') ||
            modalOverlay.classList.contains('active') ||
            mainMenu.classList.contains('active') ||
            endingOverlay.classList.contains('active');
    }

    // ---------- 剧本 ----------
    var SCRIPT = [
        // ===== 序章 =====
        { chapter: '序章', subtitle: '放学后的教室' },
        { bg: 'classroom', text: '放学后的教室，夕阳把课桌涂成了蜂蜜色。' },
        { text: '值日生早就走了，只剩靠窗的那一排还亮着。' },
        { text: '她趴在桌上，铅笔在纸上来回，橡皮屑堆成一座小山。' },
        { who: 'heroine', mood: 'happy', text: '啊，你来得正好。' },
        { text: '我放下书包：「被班主任抓去搬东西，刚逃回来。」' },
        { who: 'heroine', mood: 'smile', text: '辛苦了。那个……能不能帮我看看这个？' },
        { text: '她把画板转过来。' },
        { text: '一块还没上色的看板，画着星星、咖啡杯，还有一只打瞌睡的猫。' },
        { who: 'heroine', mood: 'shy', text: '我们班学园祭要做「星空咖啡厅」，看板归我负责……可我总觉得少了点什么。' },
        { text: '我看了很久。' },
        { text: '线条很干净，构图也稳当，怎么看都不像「少了点什么」。' },
        { who: 'heroine', mood: 'sad', text: '你也觉得奇怪吧。明明已经画了三遍。' },
        {
            choice: [
                { label: '少了你的署名吧。', affection: 8, mood: 'surprised', reply: '诶……署名？' },
                { label: '颜色再暖一点，会更像傍晚。', affection: 10, mood: 'normal', reply: '……暖一点。' },
                { label: '我陪你一起画完吧。', affection: 12, mood: 'happy', reply: '真的？' }
            ]
        },
        { who: 'heroine', mood: 'happy', text: '那……就再试一次。' },
        { text: '她把一支铅笔塞进我手里。笔杆上还留着她的温度。' },

        // ===== 第一章 =====
        { chapter: '第一章', subtitle: '两个人的准备' },
        { bg: 'classroom', text: '窗外的天色一点点沉下去，教室的灯亮了起来。' },
        { text: '她调颜料，我描线；偶尔肩膀碰到，又很快分开。' },
        { who: 'heroine', mood: 'normal', text: '其实我不太会和人打交道。' },
        { who: 'heroine', mood: 'shy', text: '画画的时候比较自在。不用想着下一句该说什么。' },
        { text: '我低头描着星星的边，没接话。' },
        { who: 'heroine', mood: 'smile', text: '所以接到看板这个任务的时候，我还挺开心的。' },
        { text: '「为什么？」' },
        { who: 'heroine', mood: 'normal', text: '因为……大家会记住这个班吧。至少会记住这块看板。' },
        { who: 'heroine', mood: 'shy', text: '如果还能顺便记住我，就更好了。' },
        { text: '她说得很轻，像怕被晚风听见。' },
        {
            choice: [
                { label: '你画得这么认真，谁都会记住的。', affection: 9, mood: 'shy', reply: '……你、你突然说这种话。' },
                { label: '我已经记住了。', affection: 10, mood: 'shy', reply: '……犯规。' },
                { label: '放心，忘不了，毕竟我描了一晚上线。', affection: 5, mood: 'angry', reply: '喂，那是我的看板！' }
            ]
        },
        { text: '她笑起来的时候，整个教室好像都亮了一点。' },
        { text: '肚子不合时宜地叫了一声。' },
        { who: 'heroine', mood: 'surprised', text: '……不是我。' },
        { text: '「明明就是。」' },
        { who: 'heroine', mood: 'happy', text: '那、那先去便利店！我请客，就当是劳务费。' },

        // ===== 第二章 =====
        { chapter: '第二章', subtitle: '天台的风' },
        { bg: 'roof', text: '便利店的天台，风把塑料袋吹得哗啦响。' },
        { text: '我们并排坐在水泥台阶上，看远处的高楼一盏一盏亮起来。' },
        { who: 'heroine', mood: 'normal', text: '小时候我搬过三次家。' },
        { who: 'heroine', mood: 'sad', text: '每次刚交到朋友，就又要走。后来就懒得主动了。' },
        { text: '她晃了晃手里的汽水罐，气泡声很轻。' },
        { who: 'heroine', mood: 'shy', text: '所以学园祭……算是我第一次认真参加这种活动。' },
        { who: 'heroine', mood: 'sad', text: '要是搞砸了，大概就再也不想参加了。' },
        { text: '风把她的刘海吹乱，她没有去理。' },
        {
            choice: [
                { label: '你做得很好，真的。', affection: 9, mood: 'shy', reply: '……嗯。' },
                { label: '（安静地陪她坐着）', affection: 7, mood: 'surprised', reply: '……你不安慰我吗？' },
                { label: '（伸手，把她的头发别到耳后）', affection: 12, mood: 'shy', reply: '！……谢谢。' }
            ]
        },
        { text: '过了很久，她轻轻吐出一口气。' },
        { who: 'heroine', mood: 'smile', text: '好像，没那么怕了。' },
        { text: '远处传来学校的预备铃。' },
        { who: 'heroine', mood: 'happy', text: '回去吧。看板还差最后一点。' },

        // ===== 第三章：岔路 =====
        { chapter: '第三章', subtitle: '放学后的岔路' },
        { bg: 'classroom', text: '第二天放学，她把两张传单摊在桌上。' },
        { text: '一张是画材店的折扣券，一张是班里搬物资的排班表。' },
        { who: 'heroine', mood: 'normal', text: '那个……明天放学后，你有空吗？' },
        { text: '她问得很轻，手指在传单边缘来回。' },
        { who: 'heroine', mood: 'shy', text: '画材还差一点，班里也要搬东西……我一个人有点忙不过来。' },
        { text: '窗外的云压得很低，像是要下雨。' },
        {
            choice: [
                { label: '陪她去画材店。', affection: 10, setFlag: 'art', jump: 'route_art' },
                { label: '先帮班里搬物资。', affection: 9, setFlag: 'class', jump: 'route_class' },
                { label: '拉她出去透口气。', affection: 8, setFlag: 'play', jump: 'route_play' }
            ]
        },

        { label: 'route_art' },
        { bg: 'street', text: '画材店在车站前，推门时风铃响了一声。' },
        { who: 'heroine', mood: 'happy', text: '就是这里。东西有点多，你别嫌弃。' },
        { text: '她在颜料架前站定，指尖一排排点过去。' },
        { who: 'heroine', mood: 'normal', text: '这个蓝，像昨天天台的天空。' },
        { text: '我伸手替她拿下最上层的画纸。' },
        { who: 'heroine', mood: 'shy', text: '谢谢……你比看起来会照顾人。' },
        { text: '回去的路上，她把新买的笔分了一半给我。' },
        { who: 'heroine', mood: 'smile', text: '之后上色，你也来吧。' },
        { text: '我点头。夕阳把两个人的影子拉在一起。' },
        { jump: 'route_after' },

        { label: 'route_class' },
        { bg: 'classroom', text: '仓库里堆满了学园祭用的纸箱和木架。' },
        { text: '她抱着纸箱，被路过的同学起哄：「哟，两个人一起搬？」' },
        { who: 'heroine', mood: 'angry', text: '少、少废话，快来帮忙！' },
        { text: '我把最重的箱子接过来，她愣了一下。' },
        { who: 'heroine', mood: 'shy', text: '……谢了。' },
        { text: '忙完之后，她在纸箱背面画了一只歪歪扭扭的猫。' },
        { who: 'heroine', mood: 'smile', text: '这是给今天帮忙的人的谢礼。' },
        { text: '我把那只猫记了很久。' },
        { jump: 'route_after' },

        { label: 'route_play' },
        { bg: 'river', text: '我把她拉出校门的时候，她还在念叨看板的事。' },
        { who: 'heroine', mood: 'surprised', text: '等、等一下，我还没拿东西——' },
        { text: '河堤上没人，风把她的头发吹得乱七八糟。' },
        { who: 'heroine', mood: 'normal', text: '……好久没在放学后这么闲着了。' },
        { text: '她从口袋里摸出两颗糖，分我一颗。' },
        { who: 'heroine', mood: 'smile', text: '偶尔逃一次，好像也不错。' },
        { text: '夕阳落在河面上，碎成很多片。' },
        { who: 'heroine', mood: 'shy', text: '明天……还是得好好准备哦。' },
        { jump: 'route_after' },

        { label: 'route_after' },
        { text: '那天之后，我们之间好像多了一点不必说出口的默契。' },

        // ===== 第四章：雨 =====
        { chapter: '第四章', subtitle: '雨和伞' },
        { bg: 'corridor', text: '第二天放学，雨下得毫无预兆。' },
        { text: '我站在走廊尽头，看着雨帘发呆。' },
        { who: 'heroine', mood: 'surprised', text: '你没带伞？' },
        { text: '她举着一把透明的伞，伞骨上挂着一个小小的星星挂饰。' },
        { who: 'heroine', mood: 'smile', text: '一起走吧。反正顺路。' },
        { text: '雨点敲在伞面上，声音密密的。' },
        { text: '伞不大。两个人的肩膀，总要有一个淋湿。' },
        {
            choice: [
                { label: '（把伞往她那边倾）', affection: 10, mood: 'sad', reply: '……你肩膀湿了。' },
                { label: '（往她那边靠近一点）', affection: 8, mood: 'shy', reply: '……有点近。' },
                { label: '跑回去吧！', affection: 4, mood: 'surprised', reply: '诶？等、等一下——' }
            ]
        },
        { text: '她低着头，走了很久才开口。' },
        { who: 'heroine', mood: 'shy', text: '那个……谢谢你。' },
        { text: '「谢什么？」' },
        { who: 'heroine', mood: 'smile', text: '很多。看板、天台、还有现在。' },
        { text: '到路口的时候，雨小了。' },
        { who: 'heroine', mood: 'happy', text: '明天见。' },
        { text: '她转身跑进雨里，伞上的星星晃了晃。' },

        // ===== 第五章：星夜 =====
        { chapter: '第五章', subtitle: '星夜' },
        { bg: 'night', text: '雨停后的夜里，教室的灯只开了最后一排。' },
        { text: '她把速写本推到我面前。' },
        { who: 'heroine', mood: 'shy', text: '……只给你看。别笑我。' },
        { text: '本子里画着教室、天台、雨伞，还有很多个我的侧脸。' },
        {
            choice: [
                { label: '一页一页认真看完。', affection: 10, mood: 'shy', reply: '……你、你看得太仔细了。' },
                { label: '「画得真好。」', affection: 8, mood: 'happy', reply: '真的？' },
                { label: '「你以后想做什么？」', affection: 9, mood: 'normal', reply: '以后啊……' }
            ]
        },
        { who: 'heroine', mood: 'normal', text: '我想考美术大学。虽然还差得远。' },
        { who: 'heroine', mood: 'shy', text: '如果……那时候你还在就好了。' },
        { text: '窗外的路灯亮着，教室里只有翻页的声音。' },
        { text: '那一刻我忽然意识到，我不想只当这个夏天的旁观者。' },
        { who: 'heroine', mood: 'smile', text: '好啦，再看下去要收钱了。' },

        // ===== 第六章：前夜 =====
        { chapter: '第六章', subtitle: '前夜' },
        { bg: 'classroom', text: '学园祭前夜，教学楼只剩下我们这一间还亮着。' },
        { text: '看板终于完成。星星是暖黄色的，咖啡杯冒着白色的热气。' },
        { who: 'heroine', mood: 'happy', text: '完成了……！' },
        { text: '她举起双手，像完成了一件了不起的大事。' },
        { text: '我们一起把彩灯挂上窗框。灯串亮起来的一瞬间，她的侧脸被照得很软。' },
        { who: 'heroine', mood: 'normal', text: '明天，你会来吗？' },
        {
            choice: [
                { label: '当然。', affection: 8, mood: 'smile', reply: '嗯。' },
                { label: '我第一个到。', affection: 10, mood: 'happy', reply: '那我也要早点来。' },
                { label: '看情况吧。', affection: 2, mood: 'sad', reply: '……哦。' }
            ]
        },
        { text: '关灯的时候，走廊尽头只剩安全出口的绿光。' },
        { who: 'heroine', mood: 'shy', text: '那……明天见。' },
        { text: '她的脚步声在楼梯间回响，越来越远。' },

        // ===== 第七章：学园祭 =====
        { chapter: '第七章', subtitle: '学园祭' },
        { bg: 'festival', text: '学园祭当天，中庭挤满了人。' },
        { text: '「星空咖啡厅」的招牌下，她穿着围裙，忙得团团转。' },
        { who: 'heroine', mood: 'surprised', text: '欢迎光临——啊，是你！' },
        { text: '她把一杯拉花歪掉的咖啡塞给我，小声说：「救、救命。」' },
        {
            choice: [
                { label: '（挽起袖子帮她端咖啡）', affection: 9, mood: 'happy', reply: '帮大忙了……！' },
                { label: '（牵她出来透口气）', affection: 12, mood: 'surprised', reply: '等、等一下，店里——' },
                { label: '（举起手机给她拍照）', affection: 7, mood: 'angry', reply: '别拍啦！' }
            ]
        },
        { text: '傍晚，人潮渐渐往中庭涌。' },
        { who: 'heroine', mood: 'normal', text: '难得闲下来……要不要去逛逛？' },
        {
            choice: [
                { label: '去小吃摊。', affection: 8, setFlag: 'food', jump: 'fest_food' },
                { label: '看舞台演出。', affection: 9, setFlag: 'stage', jump: 'fest_stage' },
                { label: '留在摊位陪她。', affection: 10, setFlag: 'stall', jump: 'fest_stall' }
            ]
        },

        { label: 'fest_food' },
        { text: '小吃摊的油烟混着甜味，她在一盒章鱼烧前停下来。' },
        { who: 'heroine', mood: 'happy', text: '啊，这个！去年就想吃了。' },
        { text: '她叉起一个，烫得直哈气，还是坚持吃完。' },
        { who: 'heroine', mood: 'shy', text: '……你也吃一个。我请。' },
        { text: '苹果糖的糖壳在路灯下亮晶晶的。' },
        { who: 'heroine', mood: 'smile', text: '学园祭，好像也没那么可怕。' },
        { jump: 'fest_after' },

        { label: 'fest_stage' },
        { text: '舞台上是轻音部，音响震得胸口发麻。' },
        { who: 'heroine', mood: 'surprised', text: '人好多——' },
        { text: '人群一挤，她的肩膀撞到我身上。' },
        { text: '我下意识抓住她的手腕。' },
        { who: 'heroine', mood: 'shy', text: '……别松手。' },
        { text: '那首歌很长，我们谁都没有先放开。' },
        { jump: 'fest_after' },

        { label: 'fest_stall' },
        { text: '摊位前终于空了，她把最后一个杯子擦干。' },
        { who: 'heroine', mood: 'normal', text: '其实我不太会应付客人。' },
        { text: '我把椅子搬过来，在她旁边坐下。' },
        { who: 'heroine', mood: 'shy', text: '不过……有你在，好像就没那么难。' },
        { text: '她低头整理围裙，耳朵有点红。' },
        { jump: 'fest_after' },

        { label: 'fest_after' },
        { text: '天色暗下来，人流渐渐散了。' },
        { text: '她靠在摊位边，围裙上沾了一点奶油。' },
        { who: 'heroine', mood: 'smile', text: '好像，还挺成功的。' },
        { text: '远处传来试放烟火的闷响。' },
        { who: 'heroine', mood: 'surprised', text: '啊，要开始了。' },
        {
            choice: [
                { label: '一起去看吧。', affection: 10, mood: 'happy', reply: '嗯！' },
                { label: '我先去占位置。', affection: 8, mood: 'smile', reply: '那我也来。' },
                { label: '你朋友不是也在等你吗？', affection: 4, mood: 'sad', reply: '……也是。' }
            ]
        },
        { text: '她解下围裙，朝我伸出手。' },
        { text: '「走吧。」' },

        // ===== 终章：烟火 =====
        { chapter: '终章', subtitle: '烟火' },
        { bg: 'night', text: '操场边的小坡上，已经坐满了人。' },
        { text: '第一发烟火升空的时候，整片天空都亮了。' },
        { text: '她仰着头，眼睛里映着光。' },
        { who: 'heroine', mood: 'happy', text: '好漂亮……' },
        { text: '我却没在看烟火。' },
        { text: '她察觉到视线，转过头。' },
        { who: 'heroine', mood: 'shy', text: '……怎么了？' },
        { text: '第二发烟火炸开，把她的脸照得忽明忽暗。' },
        { text: '我听见自己的心跳，比烟火还响。' },
        { who: 'heroine', mood: 'normal', text: '你刚才，是不是想说什么？' },
        { finalChoice: true }
    ];

    var SUMMER = [
        { chapter: '尾声', subtitle: '暑假' },
        { bg: 'river', text: '烟火之后的第三天，夏天正式开始了。' },
        { text: '蝉鸣把整座城市填得满满的。' },
        { who: 'heroine', mood: 'smile', text: '暑假，要不要一起去海边？' },
        { text: '她把冰镇汽水贴在脸上，眼睛亮亮的。' },
        {
            choice: [
                { label: '牵住她的手。', affection: 5, setFlag: 'summer_hand', jump: 'summer_hand' },
                { label: '「下次一定。」', jump: 'summer_later' },
                { label: '「我得去打工。」', jump: 'summer_work' }
            ]
        },
        { label: 'summer_hand' },
        { text: '我握住她的手。她愣了一下，没有挣开。' },
        { who: 'heroine', mood: 'shy', text: '……那就说好了。' },
        { branch: [{ flag: 'art', to: 'summer_special' }, { to: 'summer_true' }] },
        { label: 'summer_later' },
        { who: 'heroine', mood: 'smile', text: '嗯，那下次。' },
        { text: '她笑着点头，但我总觉得那笑容里有一点寂寞。' },
        { text: '那个夏天，海边的事再也没有被提起。' },
        { ending: 'true' },
        { label: 'summer_work' },
        { who: 'heroine', mood: 'sad', text: '……也是呢。' },
        { text: '她低头拧开汽水，气泡声盖过了后半句话。' },
        { text: '那个夏天，我们谁都没有再提起海边。' },
        { ending: 'true' },
        { label: 'summer_special' },
        { bg: 'river', text: '海边的风比想象中更咸。' },
        { text: '她赤着脚在浅水里走，裙摆被浪打湿了一截。' },
        { who: 'heroine', mood: 'happy', text: '你看，颜色和画里不一样吧？' },
        { text: '她回头朝我笑，阳光落在睫毛上。' },
        { who: 'heroine', mood: 'shy', text: '明年……也一起来吧。' },
        { text: '我说好。这一次，没有犹豫。' },
        { ending: 'special' },
        { label: 'summer_true' },
        { text: '那个夏天，我们去了海边。' },
        { text: '没有告白，也没有承诺，只是并肩走了很久。' },
        { text: '回来的路上，她在我手心里写了一个字。' },
        { who: 'heroine', mood: 'smile', text: '下次，换你约我。' },
        { ending: 'true' }
    ];

    var FINAL_OPTIONS = [
        { key: 'confess', label: '「我喜欢你。」' },
        { key: 'promise', label: '「明天也一起回家吧。」' },
        { key: 'silence', label: '「……没什么。」' }
    ];

    var ENDINGS = {
        special: {
            label: 'SPECIAL END',
            short: 'SPECIAL',
            title: '夏日未晚',
            desc: '画材店、雨天、天台，还有那片海。所有绕远的路，最后都通向同一个人。'
        },
        true: {
            label: 'TRUE END',
            short: 'TRUE',
            title: '烟火下的告白',
            desc: '烟火落下之前，她先握住了你的手。这个夏天，有了新的开始。'
        },
        good: {
            label: 'GOOD END',
            short: 'GOOD',
            title: '朋友以上',
            desc: '没有告白，也没有承诺。但「明天见」三个字，已经足够。'
        },
        normal: {
            label: 'NORMAL END',
            short: 'NORMAL',
            title: '下次再说',
            desc: '有些话还留在烟火里。没关系，来日方长。'
        },
        bad: {
            label: 'BAD END',
            short: 'BAD',
            title: '错过',
            desc: '烟火散尽，人群离去。这个夏天，停在了没说出口的那句话上。'
        }
    };

    function decideEnding(key) {
        if (key === 'confess') {
            if (affection >= 80) return 'true';
            if (affection >= 75) return 'normal';
            return 'bad';
        }
        if (key === 'promise') {
            return affection >= 75 ? 'good' : 'normal';
        }
        return affection >= 78 ? 'normal' : 'bad';
    }

    function buildReaction(key, ending) {
        if (key === 'confess') {
            if (ending === 'true') {
                return [
                    { bg: 'night', text: '她愣住了。' },
                    { text: '烟火的光落在她脸上，我看见她的耳朵一点点红透。' },
                    { who: 'heroine', mood: 'shy', text: '……你、你再说一遍。' },
                    { text: '「我喜欢你。」' },
                    { text: '她低下头，很久没有出声。' },
                    { who: 'heroine', mood: 'happy', text: '……我也是。' },
                    { text: '她伸出手，指尖小心地勾住我的。' },
                    { who: 'heroine', mood: 'shy', text: '以后……也一起回家吧。' }
                ];
            }
            if (ending === 'normal') {
                return [
                    { bg: 'night', text: '她怔了一下，然后很轻地笑了。' },
                    { who: 'heroine', mood: 'sad', text: '……对不起。我还没想好。' },
                    { text: '「没关系，我可以等。」' },
                    { who: 'heroine', mood: 'shy', text: '……嗯。' },
                    { text: '烟火在头顶炸开，我们谁都没有再说话。' }
                ];
            }
            return [
                { bg: 'night', text: '她张了张嘴，最后只是移开视线。' },
                { who: 'heroine', mood: 'sad', text: '……对不起。' },
                { text: '我想说点什么，喉咙却像被烟火的声音堵住了。' },
                { text: '人群散去的时候，她说了声「我先走了」。' }
            ];
        }

        if (key === 'promise') {
            if (ending === 'good') {
                return [
                    { bg: 'night', text: '她眨眨眼，然后笑起来。' },
                    { who: 'heroine', mood: 'smile', text: '嗯。明天也一起回家吧。' },
                    { text: '虽然有些话还没说出口，但她的脚步，比平时慢了半拍。' },
                    { text: '走到路口时，她忽然回头。' },
                    { who: 'heroine', mood: 'shy', text: '……今天，谢谢你。' }
                ];
            }
            return [
                { bg: 'night', text: '她笑着点头。' },
                { who: 'heroine', mood: 'smile', text: '好呀。反正，也不急。' },
                { text: '烟火在头顶炸开，我们谁都没有再说话。' }
            ];
        }

        if (ending === 'normal') {
            return [
                { bg: 'night', text: '她看了我一会儿，什么也没问。' },
                { who: 'heroine', mood: 'sad', text: '……烟花，真好看。' },
                { text: '我说，嗯。' },
                { text: '风把她的头发吹起来，又放下。' }
            ];
        }
        return [
            { bg: 'night', text: '她轻轻「嗯」了一声，把视线移回天空。' },
            { text: '人群散去，我们隔着半步的距离，谁也没有先开口。' },
            { who: 'heroine', mood: 'sad', text: '那……我先走了。' }
        ];
    }

    // ---------- 剧情引擎 ----------
    function updateToggles() {
        autoBtn.classList.toggle('on', !!story.auto);
        skipBtn.classList.toggle('on', !!story.skip);
    }

    function buildLabels(lines) {
        var map = {};
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].label) map[lines[i].label] = i;
        }
        return map;
    }

    function startStory(lines, done) {
        clearTimeout(chapterTimer);
        chapterCard.classList.remove('show');
        story.lines = lines;
        story.labels = buildLabels(lines);
        story.i = -1;
        story.pending = [];
        story.done = done || null;
        story.auto = false;
        story.skip = false;
        story.typing = false;
        story.locked = false;
        story.chapterActive = false;
        updateToggles();
        choiceOpen = false;
        hideChoices();
        clearInterval(typeTimer);
        clearTimeout(autoTimer);
        advance();
    }

    function labelIndex(name) {
        var idx = story.labels[name];
        return typeof idx === 'number' ? idx : story.lines.length;
    }

    function branchTarget(list) {
        var fallback = null;
        for (var i = 0; i < list.length; i++) {
            var cond = list[i];
            var hasCond = cond.flag || typeof cond.affection === 'number';
            if (!hasCond) { fallback = cond.to; continue; }
            if (cond.flag && !flags[cond.flag]) continue;
            if (typeof cond.affection === 'number' && affection < cond.affection) continue;
            return cond.to;
        }
        return fallback;
    }

    function advance() {
        if (mode !== 'story' || choiceOpen || backlogOpen || overlayBlocking()) return;
        if (story.locked) {
            hideChapter();
            return;
        }
        if (story.typing) {
            finishTyping();
            return;
        }
        if (story.pending.length) {
            var pendingLine = story.pending.shift();
            pendingLine._pending = true;
            present(pendingLine);
            return;
        }
        story.i += 1;
        processStory();
    }

    function processStory() {
        while (story.i < story.lines.length) {
            var line = story.lines[story.i];
            if (line.label) {
                story.i += 1;
                continue;
            }
            if (line.jump) {
                story.i = labelIndex(line.jump);
                continue;
            }
            if (line.branch) {
                var target = branchTarget(line.branch);
                story.i = target ? labelIndex(target) : story.lines.length;
                continue;
            }
            if (line.ending) {
                var endId = line.ending;
                story.done = null;
                showEnding(endId);
                return;
            }
            present(line);
            return;
        }
        var done = story.done;
        story.done = null;
        if (done) done();
    }

    function present(line) {
        if (line.bg) setBg(line.bg);
        if (line.chapter) {
            showChapter(line);
            autoSave();
            return;
        }
        if (line.finalChoice) {
            showFinalChoices();
            autoSave();
            return;
        }
        if (line.choice) {
            showChoices(line.choice);
            autoSave();
            return;
        }
        var who = line.who === 'heroine' ? HEROINE : '';
        setSpeaker(who);
        setMood(line.mood || 'normal');
        pushLog(who, line.text);
        typeText(line.text);
        if (!line._pending) autoSave();
    }

    function showChapter(line) {
        story.locked = true;
        story.chapterActive = true;
        currentChapter = line.chapter;
        currentChapterSub = line.subtitle || '';
        chapterKicker.textContent = line.chapter;
        chapterSub.textContent = line.subtitle || '';
        chapterCard.classList.add('show');
        playSelect();
        clearTimeout(chapterTimer);
        chapterTimer = setTimeout(function () { hideChapter(); }, 1600);
    }

    function hideChapter() {
        if (!story.chapterActive) return;
        story.chapterActive = false;
        clearTimeout(chapterTimer);
        chapterCard.classList.remove('show');
        setTimeout(function () {
            if (mode !== 'story') return;
            story.locked = false;
            advance();
        }, 420);
    }

    function typeText(text) {
        clearInterval(typeTimer);
        clearTimeout(autoTimer);
        story.full = text;
        story.typing = true;
        story.serial += 1;
        var token = story.serial;
        vnText.textContent = '';
        nextHint.classList.remove('show');

        var i = 0;
        var speed = story.skip ? 6 : settings.textSpeed;
        typeTimer = setInterval(function () {
            if (token !== story.serial) return;
            i += 1;
            vnText.textContent = text.slice(0, i);
            if (i >= text.length) {
                clearInterval(typeTimer);
                story.typing = false;
                nextHint.classList.add('show');
                scheduleAuto(token);
            }
        }, speed);
    }

    function finishTyping() {
        if (!story.typing) return;
        story.typing = false;
        story.serial += 1;
        clearInterval(typeTimer);
        vnText.textContent = story.full;
        nextHint.classList.add('show');
        scheduleAuto(story.serial);
    }

    function scheduleAuto(token) {
        clearTimeout(autoTimer);
        if (!story.auto || choiceOpen || backlogOpen || overlayBlocking()) return;
        autoTimer = setTimeout(function () {
            if (!story.auto || mode !== 'story' || choiceOpen || backlogOpen || overlayBlocking()) return;
            if (token !== story.serial || story.typing) return;
            advance();
        }, settings.autoDelay);
    }

    function renderChoices(options, handler) {
        choiceOpen = true;
        story.skip = false;
        updateToggles();
        clearTimeout(autoTimer);
        choicesBox.innerHTML = '';
        options.forEach(function (opt) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'choice';
            b.textContent = opt.label;
            b.addEventListener('click', function (ev) {
                ev.stopPropagation();
                handler(opt);
            });
            choicesBox.appendChild(b);
        });
        choicesBox.classList.add('show');
    }

    function showChoices(list) {
        renderChoices(list, pickChoice);
    }

    function showFinalChoices() {
        renderChoices(FINAL_OPTIONS, pickFinal);
    }

    function hideChoices() {
        choiceOpen = false;
        choicesBox.classList.remove('show');
        choicesBox.innerHTML = '';
    }

    function pickChoice(opt) {
        if (!choiceOpen) return;
        hideChoices();
        if (opt.affection) changeAffection(opt.affection);
        if (opt.setFlag) flags[opt.setFlag] = true;
        playSelect();
        if (opt.jump) {
            story.pending = [];
            story.i = labelIndex(opt.jump) - 1;
            advance();
            return;
        }
        if (opt.reply) {
            story.pending.push({
                who: 'heroine',
                mood: opt.mood || 'smile',
                text: opt.reply,
                _pending: true
            });
        }
        advance();
    }

    function pickFinal(opt) {
        if (!choiceOpen) return;
        hideChoices();
        playSelect();
        finalChoice = opt.key;
        var ending = decideEnding(finalChoice);
        story.epilogue = true;
        var reaction = buildReaction(finalChoice, ending);
        if (ending === 'true') {
            startStory(reaction.concat(SUMMER), null);
        } else {
            startStory(reaction, function () {
                showEnding(ending);
            });
        }
    }

    function toggleAuto() {
        story.auto = !story.auto;
        updateToggles();
        if (story.auto) {
            if (!story.typing && !choiceOpen && !story.locked && !backlogOpen && !overlayBlocking()) {
                scheduleAuto(story.serial);
            }
        } else {
            clearTimeout(autoTimer);
        }
    }

    function toggleSkip() {
        story.skip = !story.skip;
        updateToggles();
    }

    autoBtn.addEventListener('click', function (ev) { ev.stopPropagation(); toggleAuto(); });
    skipBtn.addEventListener('click', function (ev) { ev.stopPropagation(); toggleSkip(); });

    setInterval(function () {
        if (!story.skip || mode !== 'story' || choiceOpen || backlogOpen || overlayBlocking()) return;
        if (story.locked) {
            hideChapter();
            return;
        }
        if (story.typing) finishTyping();
        else advance();
    }, 90);

    // ---------- 存档 ----------
    function readSaves() {
        var data = {};
        try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch (e) { data = {}; }
        if (!data || typeof data !== 'object') data = {};
        if (!Array.isArray(data.slots)) data.slots = [null, null, null];
        while (data.slots.length < 3) data.slots.push(null);
        return data;
    }

    function writeSaves(data) {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            toast('无法写入存档（浏览器限制）');
            return false;
        }
    }

    function buildSaveData() {
        return {
            v: 2,
            time: Date.now(),
            index: story.i,
            affection: affection,
            flags: JSON.parse(JSON.stringify(flags)),
            bg: currentBg,
            speaker: currentSpeaker,
            mood: portrait.dataset.mood || 'normal',
            chapter: currentChapter,
            sub: currentChapterSub
        };
    }

    function autoSave() {
        if (mode !== 'story' || story.epilogue || story.i < 0) return;
        var saves = readSaves();
        saves.auto = buildSaveData();
        if (writeSaves(saves)) updateMenuState();
    }

    function saveToSlot(slotIndex) {
        if (story.epilogue) {
            toast('结局阶段无法存档');
            return;
        }
        var saves = readSaves();
        saves.slots[slotIndex] = buildSaveData();
        if (!writeSaves(saves)) return;
        updateMenuState();
        toast('已保存到存档 ' + (slotIndex + 1));
        renderSlots('save');
    }

    function resumeSave(data) {
        if (!data || !isFinite(toInt(data.index, NaN))) {
            toast('存档无效');
            return;
        }
        if (data.v && data.v < 2) {
            toast('旧版本存档不兼容，请开始新游戏');
            return;
        }
        hideOverlays();
        setMode('story');
        affection = clampNum(toInt(data.affection, START_AFFECTION), 0, MAX_AFFECTION);
        updateAffectionMeter();
        flags = {};
        if (data.flags && typeof data.flags === 'object') {
            for (var fk in data.flags) {
                if (Object.prototype.hasOwnProperty.call(data.flags, fk) && data.flags[fk]) {
                    flags[fk] = true;
                }
            }
        }
        backlog = [];
        finalChoice = null;
        story.lines = SCRIPT;
        story.labels = buildLabels(SCRIPT);
        story.i = clampNum(toInt(data.index, 0), 0, SCRIPT.length - 1);
        story.pending = [];
        story.done = null;
        story.typing = false;
        story.locked = false;
        story.chapterActive = false;
        story.epilogue = false;
        story.auto = false;
        story.skip = false;
        updateToggles();
        currentChapter = data.chapter || '序章';
        currentChapterSub = data.sub || '';
        setBg(data.bg || 'classroom');
        setMood(data.mood || 'normal');
        setSpeaker(data.speaker || '');
        ensureAudio();
        startBgm();
        present(story.lines[story.i]);
    }

    function updateMenuState() {
        var saves = readSaves();
        menuContinue.disabled = !(saves.auto && isFinite(toInt(saves.auto.index, NaN)));
        menuEndingBadge.textContent = loadUnlocked().length + ' / 5';
    }

    // ---------- 弹窗 ----------
    function openModal(title) {
        modalTitle.textContent = title;
        modalBody.innerHTML = '';
        story.auto = false;
        story.skip = false;
        updateToggles();
        clearTimeout(autoTimer);
        modalOverlay.classList.add('active');
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
    }

    modalClose.addEventListener('click', function (ev) { ev.stopPropagation(); closeModal(); });

    modalOverlay.addEventListener('click', function (ev) {
        if (ev.target === modalOverlay) closeModal();
    });

    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(function () {
            toastEl.classList.remove('show');
        }, 1600);
    }

    function buildSlot(opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot' + (opt.auto ? ' slot-auto' : '') + (opt.data ? '' : ' slot-empty');
        if (opt.disabled) btn.disabled = true;

        var tag = document.createElement('span');
        tag.className = 'slot-tag';
        tag.textContent = opt.tag;

        var main = document.createElement('span');
        main.className = 'slot-main';
        var chap = document.createElement('span');
        chap.className = 'slot-chapter';
        var meta = document.createElement('span');
        meta.className = 'slot-meta';

        if (opt.data) {
            chap.textContent = (opt.data.chapter || '序章') +
                (opt.data.sub ? ' · ' + opt.data.sub : '');
            meta.textContent = formatTime(opt.data.time) +
                ' · 好感度 ' + (opt.data.affection != null ? opt.data.affection : '-');
        } else {
            chap.textContent = '空存档';
            meta.textContent = opt.hint || (opt.auto ? '游戏过程中自动记录' : '点击保存');
        }

        main.appendChild(chap);
        main.appendChild(meta);
        btn.appendChild(tag);
        btn.appendChild(main);
        if (opt.onClick) {
            btn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                opt.onClick();
            });
        }
        return btn;
    }

    function renderSlots(whichMode) {
        slotMode = whichMode;
        modalBody.innerHTML = '';
        var saves = readSaves();
        var list = document.createElement('div');
        list.className = 'slot-list';

        list.appendChild(buildSlot({
            tag: '自动存档',
            auto: true,
            data: saves.auto,
            disabled: whichMode === 'save' || (whichMode === 'load' && !saves.auto),
            hint: whichMode === 'save' ? '自动存档不可覆盖' : '',
            onClick: function () {
                if (saves.auto) resumeSave(saves.auto);
            }
        }));

        for (var i = 0; i < 3; i++) {
            (function (idx) {
                var data = saves.slots[idx];
                list.appendChild(buildSlot({
                    tag: '存档 ' + (idx + 1),
                    data: data,
                    disabled: whichMode === 'load' && !data,
                    onClick: function () {
                        if (whichMode === 'save') saveToSlot(idx);
                        else if (data) resumeSave(data);
                    }
                }));
            })(i);
        }

        modalBody.appendChild(list);
    }

    function openSlots(whichMode) {
        openModal(whichMode === 'save' ? '保存进度' : '读取进度');
        renderSlots(whichMode);
    }

    // ---------- 设置 ----------
    function settingRow(label, key, min, max, step, unit) {
        var row = document.createElement('div');
        row.className = 'setting-row';

        var name = document.createElement('span');
        name.textContent = label;

        var input = document.createElement('input');
        input.type = 'range';
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(settings[key]);

        var val = document.createElement('span');
        val.className = 'setting-value';
        val.textContent = settings[key] + unit;

        input.addEventListener('input', function () {
            settings[key] = clampNum(toInt(input.value, settings[key]), min, max);
            val.textContent = settings[key] + unit;
            saveSettings();
        });

        row.appendChild(name);
        row.appendChild(input);
        row.appendChild(val);
        return row;
    }

    function openSettings() {
        openModal('设置');
        modalBody.appendChild(settingRow('文字速度', 'textSpeed', 8, 60, 2, 'ms'));
        modalBody.appendChild(settingRow('自动间隔', 'autoDelay', 700, 3000, 100, 'ms'));
        modalBody.appendChild(settingRow('BGM 音量', 'bgm', 0, 100, 5, '%'));
        modalBody.appendChild(settingRow('音效音量', 'sfx', 0, 100, 5, '%'));

        var foot = document.createElement('div');
        foot.className = 'setting-foot';
        var reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'gm-btn';
        reset.textContent = '恢复默认设置';
        reset.addEventListener('click', function (ev) {
            ev.stopPropagation();
            settings = {
                textSpeed: DEFAULT_SETTINGS.textSpeed,
                autoDelay: DEFAULT_SETTINGS.autoDelay,
                bgm: DEFAULT_SETTINGS.bgm,
                sfx: DEFAULT_SETTINGS.sfx
            };
            saveSettings();
            openSettings();
            toast('已恢复默认设置');
        });
        foot.appendChild(reset);
        modalBody.appendChild(foot);
    }

    // ---------- 结局鉴赏 ----------
    function openGallery() {
        openModal('结局鉴赏');
        var unlocked = loadUnlocked();
        var order = ['special', 'true', 'good', 'normal', 'bad'];

        var count = document.createElement('p');
        count.className = 'about-text';
        count.style.marginBottom = '14px';
        count.textContent = '已解锁 ' + unlocked.length + ' / 5 个结局';
        modalBody.appendChild(count);

        var grid = document.createElement('div');
        grid.className = 'gallery-grid';
        order.forEach(function (id) {
            var e = ENDINGS[id];
            var got = unlocked.indexOf(id) >= 0;
            var card = document.createElement('div');
            card.className = 'gallery-card ' + (got ? 'unlocked' : 'locked');

            var label = document.createElement('div');
            label.className = 'gallery-label';
            label.textContent = got ? e.label : '???';

            var title = document.createElement('div');
            title.className = 'gallery-title';
            title.textContent = got ? e.title : '尚未解锁';

            var desc = document.createElement('div');
            desc.className = 'gallery-desc';
            desc.textContent = got ? e.desc : '完成对应条件的路线后解锁。';

            card.appendChild(label);
            card.appendChild(title);
            card.appendChild(desc);
            grid.appendChild(card);
        });
        modalBody.appendChild(grid);
    }

    // ---------- 关于 ----------
    function openAbout() {
        openModal('关于');
        var wrap = document.createElement('div');
        wrap.className = 'about-text';
        wrap.innerHTML =
            '<p><strong>二中旮旯给木 · 放学后的约定</strong></p>' +
            '<p><strong>（HDF制作，仅供娱乐）</strong></p>' +
            '<p>恋爱视觉小说原型。学园祭前夜，她请你帮忙完成最后一块看板。夕阳、天台、雨伞、烟火——这个夏天，还差一句话。</p>' +
            '<p>操作方式：</p>' +
            '<ul class="about-list">' +
            '<li>点击画面 / 空格 / 回车：推进对话</li>' +
            '<li>打字过程中点击：立即显示整句</li>' +
            '<li>自动 / 快进 / 记录：顶部与菜单栏</li>' +
            '<li>Esc：打开菜单；关闭弹窗</li>' +
            '<li>存档：主界面「读取存档」或游戏内菜单「保存进度」</li>' +
            '</ul>' +
            '<p style="margin-top:14px;color:#9d8299">v1.0 · 纯前端演示 · 立绘与场景均由 SVG / CSS 绘制</p>';
        modalBody.appendChild(wrap);
    }

    // ---------- 启动画面 ----------
    var splashTimer = null;
    var splashDone = false;

    function showSplash() {
        clearTimeout(splashTimer);
        splash.classList.add('show');
        splashTimer = setTimeout(endSplash, 3400);
    }

    function endSplash() {
        if (splashDone) return;
        splashDone = true;
        clearTimeout(splashTimer);
        splash.classList.add('hide');
        setTimeout(function () {
            splash.classList.remove('show');
            splash.classList.remove('hide');
            if (params.get('autostart') === '1') beginStory();
        }, 780);
    }

    splash.addEventListener('click', function (ev) {
        ev.stopPropagation();
        endSplash();
    });

    // ---------- 主界面 / 流程 ----------
    function showMainMenu() {
        hideOverlays();
        stopBgm();
        setMode('menu');
        setBg('classroom');
        setMood('smile');
        setSpeaker('');
        updateMenuState();
        mainMenu.classList.add('active');
        if (audio.ctx) {
            ensureAudio();
            startBgm();
        }
    }

    function beginStory() {
        hideOverlays();
        affection = START_AFFECTION;
        finalChoice = null;
        flags = {};
        backlog = [];
        story.epilogue = false;
        updateAffectionMeter();
        setMode('story');
        setBg('classroom');
        setMood('normal');
        setSpeaker('');
        ensureAudio();
        startBgm();
        playStartSound();
        startStory(SCRIPT, null);
    }

    function showEnding(id) {
        var e = ENDINGS[id] || ENDINGS.normal;
        var list = saveUnlocked(id);

        setMode('ending');
        stopBgm();
        playEndingSound();
        eLabel.textContent = e.label;
        eTitle.textContent = e.title;
        eDesc.textContent = e.desc;
        eAffection.textContent = String(affection);
        eEnding.textContent = e.short;
        eUnlocked.textContent = list.length + ' / 5';
        updateMenuState();
        endingOverlay.classList.add('active');

        postToHost({
            type: 'story_complete',
            game: 'heart_vn',
            ending: id,
            affection: affection,
            unlocked: list.length
        });
    }

    // ---------- 游戏内菜单 ----------
    function openGameMenu() {
        if (mode !== 'story' || story.locked || modalOverlay.classList.contains('active') || backlogOpen) return;
        story.auto = false;
        story.skip = false;
        updateToggles();
        clearTimeout(autoTimer);
        gameMenu.classList.add('active');
    }

    function closeGameMenu() {
        gameMenu.classList.remove('active');
    }

    gameMenuClose.addEventListener('click', function (ev) { ev.stopPropagation(); closeGameMenu(); });
    gmResume.addEventListener('click', function (ev) { ev.stopPropagation(); closeGameMenu(); });

    gmSave.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (story.epilogue) {
            toast('结局阶段无法存档');
            return;
        }
        openSlots('save');
    });

    gmLoad.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openSlots('load');
    });

    gmSettings.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openSettings();
    });

    gmTitle.addEventListener('click', function (ev) {
        ev.stopPropagation();
        closeGameMenu();
        showMainMenu();
    });

    // ---------- 主菜单按钮 ----------
    menuNew.addEventListener('click', function (ev) {
        ev.stopPropagation();
        playSelect();
        beginStory();
    });

    menuContinue.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var saves = readSaves();
        if (saves.auto) {
            playSelect();
            resumeSave(saves.auto);
        } else {
            toast('还没有可继续的进度');
        }
    });

    menuLoad.addEventListener('click', function (ev) {
        ev.stopPropagation();
        playSelect();
        openSlots('load');
    });

    menuSettings.addEventListener('click', function (ev) {
        ev.stopPropagation();
        playSelect();
        openSettings();
    });

    menuGallery.addEventListener('click', function (ev) {
        ev.stopPropagation();
        playSelect();
        openGallery();
    });

    menuAbout.addEventListener('click', function (ev) {
        ev.stopPropagation();
        playSelect();
        openAbout();
    });

    menuFullBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        try {
            if (!document.fullscreenElement) {
                var p = document.documentElement.requestFullscreen();
                if (p && p.catch) p.catch(function () { toast('当前环境不支持全屏'); });
            } else {
                document.exitFullscreen();
            }
        } catch (e) {
            toast('当前环境不支持全屏');
        }
    });

    // ---------- 结局记录 ----------
    function loadUnlocked() {
        try {
            var raw = localStorage.getItem(STORE_KEY);
            var list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function saveUnlocked(id) {
        var list = loadUnlocked();
        if (list.indexOf(id) < 0) {
            list.push(id);
            try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
        }
        return list;
    }

    // ---------- 记录 ----------
    function pushLog(name, text) {
        backlog.push({ name: name, text: text });
        if (backlog.length > 160) backlog.shift();
    }

    function renderLog() {
        backlogList.innerHTML = '';
        if (!backlog.length) {
            var empty = document.createElement('div');
            empty.className = 'bl-empty';
            empty.textContent = '还没有对话记录';
            backlogList.appendChild(empty);
            return;
        }
        backlog.forEach(function (item) {
            var div = document.createElement('div');
            div.className = 'bl-item' + (item.name ? '' : ' bl-narrator');
            if (item.name) {
                var nameSpan = document.createElement('span');
                nameSpan.className = 'bl-name';
                nameSpan.textContent = item.name;
                div.appendChild(nameSpan);
            }
            div.appendChild(document.createTextNode(item.text));
            backlogList.appendChild(div);
        });
        backlogList.scrollTop = backlogList.scrollHeight;
    }

    function openLog() {
        backlogOpen = true;
        story.auto = false;
        story.skip = false;
        updateToggles();
        clearTimeout(autoTimer);
        renderLog();
        backlogOverlay.classList.add('active');
    }

    function closeLog() {
        backlogOpen = false;
        backlogOverlay.classList.remove('active');
    }

    logBtn.addEventListener('click', function (ev) { ev.stopPropagation(); openLog(); });
    logClose.addEventListener('click', function (ev) { ev.stopPropagation(); closeLog(); });

    backlogOverlay.addEventListener('click', function (ev) {
        if (ev.target === backlogOverlay) closeLog();
    });

    menuBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        openGameMenu();
    });

    // ---------- 结局界面 ----------
    playAgainBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        beginStory();
    });

    toTitleBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        showMainMenu();
    });

    // ---------- 交互 ----------
    stage.addEventListener('click', function (ev) {
        if (ev.target.closest('button, .choice, .overlay')) return;
        if (mode === 'story') {
            if (!choiceOpen && !backlogOpen && !overlayBlocking()) playAdvanceSound();
            advance();
        }
    });

    document.addEventListener('pointerdown', function () {
        if (mode === 'menu' && !bgm.timer) {
            ensureAudio();
            startBgm();
        }
    });

    window.addEventListener('keydown', function (ev) {
        if (splash.classList.contains('show')) {
            if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'Escape') {
                ev.preventDefault();
                endSplash();
            }
            return;
        }
        if (ev.key === 'Escape') {
            if (modalOverlay.classList.contains('active')) { closeModal(); return; }
            if (gameMenu.classList.contains('active')) { closeGameMenu(); return; }
            if (backlogOpen) { closeLog(); return; }
            if (mode === 'story') { openGameMenu(); return; }
        }
        if (ev.key !== ' ' && ev.key !== 'Enter') return;
        if (ev.target && ev.target.tagName === 'BUTTON') return;
        if (mode !== 'story' || backlogOpen) return;
        if (gameMenu.classList.contains('active') || modalOverlay.classList.contains('active')) return;
        ev.preventDefault();
        if (!choiceOpen) playAdvanceSound();
        advance();
    });

    function postToHost(payload) {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(payload, '*');
            }
        } catch (e) { /* ignore */ }
    }

    window.addEventListener('message', function (ev) {
        var data = ev.data;
        if (data && data.type === 'story_start') {
            hideOverlays();
            beginStory();
        }
    });

    // ---------- 花瓣 ----------
    function initPetals() {
        var glyphs = ['🌸', '🌸', '🌸', '✿', '❀'];
        for (var i = 0; i < 14; i++) {
            var p = document.createElement('span');
            p.className = 'petal';
            p.textContent = glyphs[i % glyphs.length];
            p.style.left = (Math.random() * 100).toFixed(1) + '%';
            p.style.fontSize = (10 + Math.random() * 12).toFixed(1) + 'px';
            p.style.animationDuration = (10 + Math.random() * 10).toFixed(1) + 's';
            p.style.animationDelay = (-Math.random() * 15).toFixed(1) + 's';
            p.style.setProperty('--drift', (Math.random() * 140 - 70).toFixed(0) + 'px');
            p.style.opacity = (0.3 + Math.random() * 0.35).toFixed(2);
            petals.appendChild(p);
        }
    }

    // ---------- 初始化 ----------
    namebox.textContent = HEROINE;
    updateAffectionMeter();
    applyMuteIcons();
    setMode('menu');
    updateToggles();
    updateMenuState();
    initPetals();
    startBlinkLoop();
    preloadMoodImages();
    showMainMenu();

    if (params.get('splash') === '0') {
        splashDone = true;
        if (params.get('autostart') === '1') {
            setTimeout(beginStory, 400);
        }
    } else {
        showSplash();
    }
})();
