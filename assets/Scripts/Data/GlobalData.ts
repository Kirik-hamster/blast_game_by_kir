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
    public static openNextLevel(currentLevel: number) {
        let currentMax = this.getUnlockedLevel();
        if (currentLevel >= currentMax) {
            cc.sys.localStorage.setItem(this.UNLOCKED_KEY, (currentLevel + 1).toString());
        }
    }

    /**
     * Сохраняет результат и открывает следующий уровень
     */
    public static saveLevelProgress(levelId: number, stars: number) {
        let oldStars = this.getStarsForLevel(levelId);
        if (stars > oldStars) {
            cc.sys.localStorage.setItem(this.STARS_KEY_PREFIX + levelId, stars.toString());
        }

        if (stars >= 1) {
            let currentMaxUnlocked = this.getUnlockedLevel();
            if (levelId >= currentMaxUnlocked) {
                cc.sys.localStorage.setItem(this.UNLOCKED_KEY, (levelId + 1).toString());
            }
        }
    }

    /**
     * Возвращает индекс самого высокого открытого уровня (по умолчанию 1)
     */
    public static getUnlockedLevel(): number {
        let saved = cc.sys.localStorage.getItem(this.UNLOCKED_KEY);
        return saved ? parseInt(saved) : 1;
    }

    public static getStarsForLevel(levelId: number): number {
        let saved = cc.sys.localStorage.getItem(this.STARS_KEY_PREFIX + levelId);
        return saved ? parseInt(saved) : 0;
    }
}