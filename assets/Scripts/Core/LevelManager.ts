/**
 * LEVEL MANAGER (Мозг Уровня)
 * * ПОЧЕМУ ЭТОТ ФАЙЛ СУЩЕСТВУЕТ:
 * 1. Разделение ответственности: GameController только "рисует" и слушает клики, 
 * а LevelManager решает, выиграл игрок или нет.
 * * 2. Будущее сокращение кода (Масштабируемость):
 * - Цели: Когда на Уровне 1 нужно будет собрать 20 красных кубиков, мы добавим логику сюда.
 * GameController не будет плодить переменные типа `redCollected`, он просто скажет: 
 * "Я лопнул красный кубик, учти это".
 * - Бустеры: В ТЗ на Уровне 4 открывается Телепорт, а на Уровне 10 он становится бесконечным.
 * Вместо того чтобы забивать основной код условиями `if (level == 10)`, мы просто 
 * настроим поведение бустера здесь, в одном методе.
 * - Интерфейс: Этот файл станет источником данных для динамического UI (показать нужные иконки целей).
 */
import { LEVEL_DATA } from "../Data/LevelConfig";
import GlobalData from "../Data/GlobalData";

export default class LevelManager {
    public currentScore: number = 0;
    public targetScore: number = 0;
    public currentMoves: number = 0;
    public teleports: number = 0;
    public bombs: number = 0;
    public removers: number = 0;
    public spawners: number = 0;

    // Текущий прогресс: ID объекта -> сколько еще нужно собрать
    public targetsProgress: Map<number, number> = new Map();

    constructor() {
        this.init();
    }

    private init() {
        const config = LEVEL_DATA[GlobalData.selectedLevel] || LEVEL_DATA[1];
        this.currentScore = 0;
        this.targetScore = config.target;
        this.currentMoves = config.moves;
        this.teleports = config.teleports;
        this.bombs = config.bombs;
        this.removers = config.removers;
        this.spawners = config.spawners;

        // Инициализируем прогресс целей из конфига
        this.targetsProgress.clear();
        if (config.targets) {
            config.targets.forEach(t => {
                this.targetsProgress.set(t.id, t.count);
            });
        }
        
    }

    /**
     * Метод уменьшения счетчика цели
     */
    public collectItem(id: number) {
        if (this.targetsProgress.has(id)) {
            let remaining = this.targetsProgress.get(id);
            if (remaining > 0) {
                this.targetsProgress.set(id, remaining - 1);
            }
        }
    }

    public addScore(amount: number) {
        this.currentScore += amount;
    }

    public useMove(): boolean {
        this.currentMoves--;
        return this.currentMoves <= 0;
    }

    // Проверка условий финала
    public isWin(): boolean {
        const scoreReached = this.currentScore >= this.targetScore;
    
        let targetsReached = true;
        this.targetsProgress.forEach((count) => {
            if (count > 0) targetsReached = false;
        });

        return scoreReached && targetsReached;
    }

    public isGameOver(): boolean {
        return this.currentMoves <= 0;
    }
}