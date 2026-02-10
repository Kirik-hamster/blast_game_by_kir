/**
 * GlobalData — главный узел хранения прогресса и логики достижений.
 * * ЧТО ЭТО ДЕЛАЕТ:
 * 1. Сохранение: Управляет записью открытых уровней и заработанных звезд в локальную память.
 * 2. Аналитика: Рассчитывает успешность прохождения уровня (звезды) по разнице очков.
 * 3. Глобальный доступ: Позволяет любой сцене быстро узнать состояние прогресса игрока.
 * * ПЛАН НА БУДУЩЕЕ:
 * Сейчас используется cc.sys.localStorage (память браузера). В дальнейшем этот класс будет 
 * расширен для работы с SDK Яндекс.Игр и ВК Bridge, чтобы прогресс хранился в облаке платформ.
 */

export default class GlobalData {
    public static selectedLevel: number = 1; // Уровень по умолчанию

    // Ключи для сохранения
    private static readonly UNLOCKED_KEY = "unlocked_level_index";
    private static readonly STARS_KEY_PREFIX = "stars_lvl_";

    // Локальный кэш данных, чтобы игра не тормозила при чтении
    private static dataCache: { [key: string]: any } = {};
    private static isCloudActive: boolean = false;

    /**
     * Первичная загрузка данных из Яндекса. 
     * Вызывай это ОДИН РАЗ после инициализации SDK.
     */
    public static async initCloudData() {
        console.log("--- ПОПЫТКА ЗАГРУЗКИ ОБЛАКА ---");
        

        if (window['ysdk']) {
            try {
                const player = await window['ysdk'].getPlayer({ scopes: false });
                const stats = await player.getData();
                
                // Переносим всё из облака в наш кэш
                this.dataCache = stats || {};
                this.isCloudActive = true;
                console.log("DATA: Использование ОБЛАКА Яндекса. LocalStorage отключен.");
            } catch (e) {
                console.log("DATA: Ошибка облака, переход на LocalStorage:", e);
                this.loadFromLocalStorage();
            }
        } else {
            this.loadFromLocalStorage();
        }
    }

    private static loadFromLocalStorage() {
        this.isCloudActive = false;
        console.log("DATA: Использование LOCALSTORAGE.");
        
        // Загружаем макс. уровень
        const unlocked = cc.sys.localStorage.getItem(this.UNLOCKED_KEY);
        if (unlocked) this.dataCache[this.UNLOCKED_KEY] = parseInt(unlocked);

        // Загружаем звезды (пробегаем по первым 20 уровням для примера)
        for (let i = 1; i <= 20; i++) {
            const key = this.STARS_KEY_PREFIX + i;
            const stars = cc.sys.localStorage.getItem(key);
            if (stars) this.dataCache[key] = parseInt(stars);
        }
    }
    

    /**
     * Рассчитывает кол-во звезд на основе счета и цели уровня
     */
    public static calculateStars(score: number, target: number): number {
        if (score < target) return 0; // Не прошли

        const extraPoints = score - target;

        if (extraPoints >= 150) return 3; // На 120 больше
        if (extraPoints >= 75) return 2;  // На 50 больше
        return 1; // Базовая победа
    }

    /**
     * Сохраняет прогресс: открывает следующий уровень
     */
    public static async openNextLevel(currentLevel: number) {
        let currentMax = this.getUnlockedLevel();
        if (currentLevel >= currentMax) {
            this.dataCache[this.UNLOCKED_KEY] = currentLevel + 1;
            await this.syncData();
        }
    }

    /**
     * Сохраняет результат и открывает следующий уровень
     */
    public static async saveLevelProgress(levelId: number, stars: number) {
        let oldStars = this.getStarsForLevel(levelId);
        if (stars > oldStars) {
            this.dataCache[this.STARS_KEY_PREFIX + levelId] = stars;
        }

        if (stars >= 1) {
            let currentMaxUnlocked = this.getUnlockedLevel();
            if (levelId >= currentMaxUnlocked) {
                this.dataCache[this.UNLOCKED_KEY] = levelId + 1;
            }
        }
        await this.syncData();
    }

    private static async syncData() {
        if (this.isCloudActive) {
            try {
                const player = await window['ysdk'].getPlayer({ scopes: false });
                await player.setData(this.dataCache);
                console.log("SYNC: Данные сохранены в Облако.");
            } catch (e) {
                console.log("SYNC: Ошибка записи в облако:", e);
            }
        } else {
            console.log("SYNC: Данные сохранены в LocalStorage.");
            for (let key in this.dataCache) {
                cc.sys.localStorage.setItem(key, this.dataCache[key].toString());
            }
        }
    }

    /**
     * Возвращает индекс самого высокого открытого уровня (по умолчанию 1)
     */
    public static getUnlockedLevel(): number {
        return this.dataCache[this.UNLOCKED_KEY] || 1;
    }

    public static getStarsForLevel(levelId: number): number {
        return this.dataCache[this.STARS_KEY_PREFIX + levelId] || 0;
    }
}