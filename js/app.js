
/* ===================================
   FOKUS. - MAIN APPLICATION
=================================== */

// ---------- STORAGE ----------

let STORAGE_KEY = "fokusAppData";
const ACCOUNTS_KEY = "fokusAccounts";

function loadAccounts() {
    try {
        const saved = JSON.parse(localStorage.getItem(ACCOUNTS_KEY));
        return saved && typeof saved === "object" ? saved : {};
    } catch (error) {
        console.warn("Could not load accounts:", error);
        return {};
    }
}

let accounts = loadAccounts();
let currentAccount = null;

function saveAccounts() {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function accountDataKey(account) {
    return `fokusAppData:${account.id}`;
}

function loadData(key = STORAGE_KEY) {
    try {
        const saved = JSON.parse(localStorage.getItem(key));

        if (saved && typeof saved === "object") {
            return {
                tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
                xp: Number(saved.xp) || 0,
                sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
                streak: Number(saved.streak) || 0,
                lastActive: saved.lastActive || null,
                settings: saved.settings || {}
            };
        }
    } catch (error) {
        console.warn("Could not load saved data:", error);
    }

    return {
        tasks: [],
        xp: 0,
        sessions: [],
        streak: 0,
        lastActive: null,
        settings: {}
    };
}

let data = loadData();

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---------- DATE ----------

function todayKey() {
    const date = new Date();

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

document.getElementById("todayDate").textContent =
    new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

// ---------- LOCAL SIGN-IN ----------

function updateGreeting(username) {
    const hour = new Date().getHours();
    const greeting = hour < 12
        ? "Good morning"
        : hour < 18
            ? "Good afternoon"
            : "Good evening";

    document.getElementById("greeting").textContent =
        `${greeting}, ${username}! ☀️`;
}

function setLoginMessage(message, isError = false) {
    const element = document.getElementById("loginMessage");
    element.textContent = message;
    element.classList.toggle("error", isError);
}

function renderProfile() {
    if (!currentAccount) return;
    document.getElementById("profileUsername").textContent = currentAccount.username;
    document.getElementById("newUsername").value = currentAccount.username;
    const avatar = document.getElementById("profileAvatar");
    if (currentAccount.photo) {
        const photo = document.createElement("img");
        photo.src = currentAccount.photo;
        photo.alt = `${currentAccount.username}'s profile photo`;
        photo.onerror = () => {
            avatar.textContent = "🌻";
        };
        avatar.replaceChildren(photo);
    } else {
        avatar.textContent = "🌻";
    }
}

function enterDashboard(account) {
    currentAccount = account;
    STORAGE_KEY = accountDataKey(account);
    data = loadData(STORAGE_KEY);
    durations.focus = Number(data.settings.focusDuration) || 25;
    document.getElementById("focusDuration").value = String(durations.focus);
    if (currentMode === "focus") selectMode("focus");
    sessionStorage.setItem("fokusAccountId", account.id);
    document.body.classList.add("authenticated");
    updateGreeting(account.username);
    renderProfile();
    renderTasks();
    updateDashboard();
}

async function hashPassword(password) {
    if (!window.crypto || !crypto.subtle) {
        throw new Error("Secure password storage is unavailable in this browser context.");
    }
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte =>
        byte.toString(16).padStart(2, "0")
    ).join("");
}

function findAccountByUsername(username) {
    const normalized = username.trim().toLowerCase();
    return Object.values(accounts).find(account =>
        account.username.toLowerCase() === normalized
    );
}

let isRegisterMode = false;
document.getElementById("toggleAuthMode").addEventListener("click", () => {
    isRegisterMode = !isRegisterMode;
    document.getElementById("registerEmailField").hidden = !isRegisterMode;
    document.getElementById("registerEmail").required = isRegisterMode;
    document.getElementById("loginDescription").textContent = isRegisterMode
        ? "Create your account to save your focus journey."
        : "Sign in to your focus space.";
    document.getElementById("loginSubmit").textContent = isRegisterMode
        ? "Create account"
        : "Sign in";
    document.getElementById("toggleAuthMode").textContent = isRegisterMode
        ? "I already have an account"
        : "Create an account";
    document.getElementById("forgotPasswordLink").hidden = isRegisterMode;
    setLoginMessage("");
});

document.getElementById("authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    const email = document.getElementById("registerEmail").value.trim();

    if (!username || password.length < 6 || (isRegisterMode && !email)) {
        setLoginMessage("Enter a username, a password with at least 6 characters, and an email to register.", true);
        return;
    }

    try {
        const passwordHash = await hashPassword(password);
        if (isRegisterMode) {
            if (findAccountByUsername(username)) {
                setLoginMessage("That username is already taken. Please choose another.", true);
                return;
            }
            if (Object.values(accounts).some(account =>
                account.email.toLowerCase() === email.toLowerCase()
            )) {
                setLoginMessage("That email already has an account.", true);
                return;
            }
            const id = crypto.randomUUID();
            const account = { id, username, email, passwordHash, photo: "" };
            accounts[id] = account;
            saveAccounts();
            enterDashboard(account);
        } else {
            const account = findAccountByUsername(username);
            if (!account || account.passwordHash !== passwordHash) {
                setLoginMessage("Username or password is incorrect.", true);
                return;
            }
            enterDashboard(account);
        }
    } catch (error) {
        setLoginMessage(error.message || "Could not complete sign-in.", true);
    }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("fokusAccountId");
    currentAccount = null;
    document.body.classList.remove("authenticated");
    document.getElementById("loginUsername").value = "";
    document.getElementById("loginPassword").value = "";
    setLoginMessage("");
    document.getElementById("loginUsername").focus();
});

let resetCode = null;
document.getElementById("forgotPasswordLink").addEventListener("click", () => {
    document.getElementById("resetForm").hidden = false;
    document.getElementById("authForm").hidden = true;
    document.getElementById("loginDescription").hidden = true;
    document.getElementById("loginMessage").textContent = "";
});
document.getElementById("cancelReset").addEventListener("click", () => {
    document.getElementById("resetForm").reset();
    document.getElementById("resetForm").hidden = true;
    document.getElementById("authForm").hidden = false;
    document.getElementById("loginDescription").hidden = false;
    document.getElementById("resetMessage").textContent = "";
    resetCode = null;
});
document.getElementById("sendResetCode").addEventListener("click", () => {
    const email = document.getElementById("resetEmail").value.trim().toLowerCase();
    const account = Object.values(accounts).find(item =>
        item.email.toLowerCase() === email
    );
    const message = document.getElementById("resetMessage");
    if (!account) {
        message.textContent = "No account is registered with that email.";
        message.classList.add("error");
        return;
    }
    resetCode = {
        accountId: account.id,
        value: String(Math.floor(100000 + Math.random() * 900000)),
        expires: Date.now() + 10 * 60 * 1000
    };
    message.classList.remove("error");
    message.textContent = `Prototype only — your reset code is ${resetCode.value}. It has not been emailed.`;
});
document.getElementById("resetForm").addEventListener("submit", async event => {
    event.preventDefault();
    const code = document.getElementById("resetCode").value.trim();
    const password = document.getElementById("resetNewPassword").value;
    const message = document.getElementById("resetMessage");
    if (!resetCode || code !== resetCode.value || Date.now() > resetCode.expires) {
        message.textContent = "The code is incorrect or has expired. Request a new one.";
        message.classList.add("error");
        return;
    }
    if (password.length < 6) {
        message.textContent = "Use a password with at least 6 characters.";
        message.classList.add("error");
        return;
    }
    accounts[resetCode.accountId].passwordHash = await hashPassword(password);
    saveAccounts();
    resetCode = null;
    message.classList.remove("error");
    message.textContent = "Password changed. You can now sign in.";
    document.getElementById("resetForm").reset();
});

document.getElementById("profileForm").addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("profileMessage");
    const username = document.getElementById("newUsername").value.trim();
    if (!username) return;
    const existing = findAccountByUsername(username);
    if (existing && existing.id !== currentAccount.id) {
        message.textContent = "That username is already taken.";
        message.classList.add("error");
        return;
    }
    const photoInput = document.getElementById("profilePhoto");
    const photo = photoInput.files[0];
    if (photo) {
        if (photo.size > 2 * 1024 * 1024) {
            message.textContent = "Please choose an image smaller than 2 MB.";
            message.classList.add("error");
            return;
        }
        currentAccount.photo = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(photo);
        });
    }
    currentAccount.username = username;
    accounts[currentAccount.id] = currentAccount;
    saveAccounts();
    updateGreeting(username);
    renderProfile();
    message.classList.remove("error");
    message.textContent = "Profile saved.";
    photoInput.value = "";
});

document.getElementById("changePasswordForm").addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("passwordMessage");
    const oldPassword = document.getElementById("oldPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    if (await hashPassword(oldPassword) !== currentAccount.passwordHash) {
        message.textContent = "Your current password is incorrect.";
        message.classList.add("error");
        return;
    }
    if (newPassword.length < 6) {
        message.textContent = "Use a new password with at least 6 characters.";
        message.classList.add("error");
        return;
    }
    currentAccount.passwordHash = await hashPassword(newPassword);
    accounts[currentAccount.id] = currentAccount;
    saveAccounts();
    document.getElementById("changePasswordForm").reset();
    message.classList.remove("error");
    message.textContent = "Password updated.";
});

// ---------- POMODORO TIMER ----------

const durations = {
    focus: 25,
    short: 5,
    long: 15
};

let currentMode = "focus";
let remainingSeconds = 25 * 60;
let timerInterval = null;
let endTime = null;

const timerDisplay = document.getElementById("timerDisplay");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const timerStatus = document.getElementById("timerStatus");
const timerCircle = document.getElementById("timerCircle");

function updateTimerDisplay() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    timerDisplay.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    document.title = `${timerDisplay.textContent} | FOKUS.`;
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    endTime = null;

    startBtn.textContent = "▶ Resume focus";
    timerStatus.textContent = "Paused";
    timerCircle.classList.remove("running");
}

function playNotification() {
    try {
        const audioContext = new (
            window.AudioContext || window.webkitAudioContext
        )();

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.12, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + 0.7
        );

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.7);
    } catch (error) {
        console.warn("Audio unavailable:", error);
    }
}

function selectMode(mode) {
    stopTimer();

    currentMode = mode;

    if (mode === "focus") {
        durations.focus =
            Number(document.getElementById("focusDuration").value);
    }

    remainingSeconds = durations[mode] * 60;

    document.querySelectorAll(".timer-tab").forEach(tab => {
        tab.classList.toggle(
            "active",
            tab.dataset.mode === mode
        );
    });

    document.getElementById("timerLabel").textContent = {
        focus: "Time to focus",
        short: "Take a little break",
        long: "Relax and recharge"
    }[mode];

    startBtn.textContent = "▶ Start " +
        (mode === "focus" ? "focus" : "break");

    timerStatus.textContent = "Ready";

    updateTimerDisplay();
}

function startTimer() {
    if (timerInterval) return;

    if (remainingSeconds <= 0) return;

    endTime = Date.now() + remainingSeconds * 1000;

    timerInterval = setInterval(() => {
        remainingSeconds = Math.max(
            0,
            Math.ceil((endTime - Date.now()) / 1000)
        );

        updateTimerDisplay();

        if (remainingSeconds <= 0) {
            completeTimer();
        }
    }, 200);

    startBtn.textContent = "Ⅱ Pause";
    timerStatus.textContent = "In progress";
    timerCircle.classList.add("running");
}

function completeTimer() {
    stopTimer();

    remainingSeconds = 0;
    updateTimerDisplay();

    playNotification();

    if (currentMode === "focus") {
        recordFocusSession(durations.focus);

        alert("Amazing work! 🌱 Your focus session is complete. You earned 25 XP!");

        selectMode("short");
    } else {
        alert("Break time is over! Ready to focus again? 🌷");

        selectMode("focus");
    }

    updateDashboard();
}

startBtn.addEventListener("click", () => {
    if (timerInterval) {
        stopTimer();
    } else {
        startTimer();
    }
});

resetBtn.addEventListener("click", () => {
    stopTimer();
    selectMode(currentMode);
});

document.querySelectorAll(".timer-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        selectMode(tab.dataset.mode);
    });
});

document.getElementById("focusDuration").addEventListener(
    "change",
    event => {
        durations.focus = Number(event.target.value);
        data.settings.focusDuration = durations.focus;
        saveData();

        if (currentMode === "focus") {
            selectMode("focus");
        }
    }
);

// ---------- TASK MANAGER ----------

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");

taskForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = taskInput.value.trim();

    if (!title) return;

    data.tasks.push({
        id: crypto.randomUUID(),
        title,
        completed: false,
        date: todayKey()
    });

    taskInput.value = "";

    saveData();
    renderTasks();
});

function renderTasks() {
    taskList.innerHTML = "";

    if (data.tasks.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state">
                <span>🌷</span>
                <p>No tasks yet. Add a little goal!</p>
            </div>
        `;
    }

    data.tasks.forEach(task => {
        const item = document.createElement("div");

        item.className = "task-item" +
            (task.completed ? " done" : "");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", "Complete " + task.title);

        const title = document.createElement("span");
        title.textContent = task.title;

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-task";
        deleteButton.textContent = "×";
        deleteButton.setAttribute("aria-label", "Delete task");

        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;

            if (task.completed) {
                addXP(10);
            }

            saveData();
            renderTasks();
            updateDashboard();
        });

        deleteButton.addEventListener("click", () => {
            data.tasks = data.tasks.filter(
                t => t.id !== task.id
            );

            saveData();
            renderTasks();
            updateDashboard();
        });

        item.append(checkbox, title, deleteButton);
        taskList.appendChild(item);
    });

    const completed = data.tasks.filter(
        task => task.completed
    ).length;

    const total = data.tasks.length;

    document.getElementById("taskTotal").textContent =
        `${total} tasks`;

    document.getElementById("taskProgress").textContent =
        `${completed} of ${total} completed`;

    document.getElementById("taskProgressBar").style.width =
        total ? `${completed / total * 100}%` : "0%";
}

// ---------- XP AND LEVEL SYSTEM ----------

function addXP(amount) {
    data.xp += amount;
    saveData();
    updateDashboard();
}

function getLevel(xp) {
    return Math.floor(xp / 100) + 1;
}

function getLevelProgress(xp) {
    return xp % 100;
}

// ---------- SESSION TRACKING ----------

function recordFocusSession(minutes) {
    data.sessions.push({
        date: todayKey(),
        minutes: minutes,
        timestamp: Date.now()
    });

    addXP(25);

    updateStreak();
    saveData();
}

function updateStreak() {
    const today = todayKey();

    if (data.lastActive === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayKey = [
        yesterday.getFullYear(),
        String(yesterday.getMonth() + 1).padStart(2, "0"),
        String(yesterday.getDate()).padStart(2, "0")
    ].join("-");

    data.streak =
        data.lastActive === yesterdayKey
            ? data.streak + 1
            : 1;

    data.lastActive = today;

    saveData();
}

// ---------- ACHIEVEMENTS ----------

function getAchievements() {
    const sessionCount = data.sessions.length;
    const achievements = [
        {
            name: "First focus session",
            icon: "🌟",
            unlocked: sessionCount >= 1
        },
        {
            name: "Focus master",
            icon: "🍅",
            unlocked: sessionCount >= 5
        },
        {
            name: "Consistency star",
            icon: "🔥",
            unlocked: data.streak >= 3
        },
        {
            name: "Task champion",
            icon: "🏆",
            unlocked: data.tasks.filter(t => t.completed).length >= 10
        },
        {
            name: "Growing stronger",
            icon: "🌳",
            unlocked: data.xp >= 500
        }
    ];

    return achievements;
}

function renderAchievements() {
    const container = document.getElementById("achievementList");

    container.innerHTML = "";

    getAchievements().forEach(achievement => {
        const item = document.createElement("div");

        item.className = "achievement" +
            (achievement.unlocked ? "" : " locked");

        item.textContent =
            `${achievement.unlocked ? "🏅" : "🔒"} ${achievement.name}`;

        container.appendChild(item);
    });
}

// ---------- PRODUCTIVITY ANALYTICS ----------

let focusChart = null;

function renderChart() {
    const labels = [];
    const values = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date();

        date.setDate(date.getDate() - i);

        const key = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");

        labels.push(
            date.toLocaleDateString("en-US", {
                weekday: "short"
            })
        );

        const minutes = data.sessions
            .filter(session => session.date === key)
            .reduce((sum, session) => sum + session.minutes, 0);

        values.push(minutes);
    }

    if (focusChart) {
        focusChart.data.labels = labels;
        focusChart.data.datasets[0].data = values;
        focusChart.update();
        return;
    }

    const canvas = document.getElementById("focusChart");

    focusChart = new Chart(canvas, {
        type: "bar",

        data: {
            labels,

            datasets: [{
                label: "Focus minutes",
                data: values,
                backgroundColor: "#91a88a",
                borderRadius: 8,
                maxBarThickness: 32
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    },
                    grid: {
                        color: "#eeeee5"
                    }
                },

                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// ---------- DASHBOARD ----------

function updateDashboard() {
    const today = todayKey();

    const todaySessions = data.sessions.filter(
        session => session.date === today
    );

    const totalMinutes = todaySessions.reduce(
        (sum, session) => sum + session.minutes,
        0
    );

    document.getElementById("focusHours").textContent =
        totalMinutes >= 60
            ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
            : `${totalMinutes} min`;

    document.getElementById("sessionCount").textContent =
        todaySessions.length;

    document.getElementById("xpCount").textContent =
        `${data.xp} XP`;

    document.getElementById("streakCount").textContent =
        `${data.streak} days`;

    const level = getLevel(data.xp);
    const progress = getLevelProgress(data.xp);

    document.getElementById("levelText").textContent =
        `Level ${level}`;

    document.getElementById("levelName").textContent =
        `${levelName(level)} · Level ${level}`;

    document.getElementById("xpProgressText").textContent =
        `${progress} / 100 XP`;

    document.getElementById("xpProgressBar").style.width =
        `${progress}%`;

    document.getElementById("nextLevel").textContent =
        `${100 - progress} XP to next level`;

    renderAchievements();
    renderChart();
}

function levelName(level) {
    if (level >= 10) return "Forest Guardian";
    if (level >= 5) return "Growing Tree";
    if (level >= 3) return "Little Plant";

    return "Seedling";
}

// ---------- FOCUS SOUNDS ----------

let audioContext = null;
let soundNodes = [];

function playFocusSound(type) {
    stopFocusSound();

    try {
        audioContext = new (
            window.AudioContext || window.webkitAudioContext
        )();

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value =
            type === "calm" ? 174.61 : 220;

        gain.gain.value = 0.025;

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();

        soundNodes = [oscillator, gain];
    } catch (error) {
        console.warn("Focus sound unavailable:", error);
    }
}

function stopFocusSound() {
    const [oscillator, gain] = soundNodes;

    if (gain && audioContext) {
        gain.gain.setTargetAtTime(
            0,
            audioContext.currentTime,
            0.05
        );
    }

    if (oscillator) {
        setTimeout(() => {
            try {
                oscillator.stop();
            } catch {}
        }, 200);
    }

    soundNodes = [];
}

// ---------- INITIALIZATION ----------

const savedAccount = accounts[sessionStorage.getItem("fokusAccountId")];
if (savedAccount) {
    currentAccount = savedAccount;
    STORAGE_KEY = accountDataKey(savedAccount);
    data = loadData(STORAGE_KEY);
    document.body.classList.add("authenticated");
    updateGreeting(savedAccount.username);
    renderProfile();
}

if (data.settings.focusDuration) {
    durations.focus = Number(data.settings.focusDuration);

    document.getElementById("focusDuration").value =
        String(durations.focus);
}

selectMode("focus");
renderTasks();
updateDashboard();

console.log("🌿 FOKUS. is ready!");


document.querySelectorAll(".sound-btn[data-sound]").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".sound-btn[data-sound]")
            .forEach(btn => btn.classList.remove("active"));

        button.classList.add("active");

        playFocusSound(button.dataset.sound);
    });
});

document.getElementById("stopSound").addEventListener("click", () => {
    stopFocusSound();

    document.querySelectorAll(".sound-btn")
        .forEach(btn => btn.classList.remove("active"));
});