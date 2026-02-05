import GridModel from "../Core/GridModel";
import { GAME_CONFIG } from "../Data/GameConfig";
import GlobalData from "../Data/GlobalData";
import { LEVEL_DATA } from "../Data/LevelConfig";

/**
 * HintService — сервис визуальных подсказок для игрока.
 * * ПРЕДНАЗНАЧЕНИЕ:
 * Помогает игроку найти возможные ходы, если он бездействует в течение определенного времени.
 * * ЛОГИКА РАБОТЫ:
 * 1. Таймер: Запускается после каждого хода или при старте игры (стандартно — 5 секунд).
 * 2. Поиск: Сканирует GridModel на наличие групп кубиков (минимум 4 штуки).
 * 3. Визуализация: Выбирает случайную группу и запускает анимацию пульсации (scale) 5 раза.
 * 4. Цикличность: После завершения анимации таймер сбрасывается и начинает отсчет заново.
 * 5. Интерактивность: При любом клике по полю или начале хода подсказка мгновенно отключается.
 * * ЗАВИСИМОСТИ:
 * - Контроллер игры (для управления таймерами Cocos)
 * - Модель сетки (для анализа данных поля)
 */
export default class HintService {
    private controller: any = null; // Используем any для гибкого доступа
    private model: GridModel = null;
    private blockIndices: number[] = [];
    
    private hintNodes: cc.Node[] = [];
    private boundShowHint = null;

    constructor(controller: any, model: GridModel, blockIndices: number[]) {
        this.controller = controller;
        this.model = model;
        this.blockIndices = blockIndices;
        this.boundShowHint = this.showHint.bind(this);
    }

    public resetTimer() {
        this.stopHint();
        this.controller.unschedule(this.boundShowHint);
        this.controller.scheduleOnce(this.boundShowHint, GAME_CONFIG.HINT_DELAY);
    }

    // Алгоритм поиска и отображения подсказки.
    private showHint() {
        const grid = this.controller.field.nodesGrid;
        if (!grid || grid.length === 0) return;

        const currentLevelIdx = GlobalData.selectedLevel;
        const config = LEVEL_DATA[currentLevelIdx];
        const currentMinMatch = (config && config.minMatch) ? config.minMatch : GAME_CONFIG.MIN_MATCH_SIZE;

        let possibleGroups: {r: number, c: number}[][] = [];

        // 1. Ищем все возможные ходы
        for (let r = 0; r < this.model.rows; r++) {
            for (let c = 0; c < this.model.cols; c++) {
                let id = this.model.gridData[r][c];
                if (id === -1 || this.blockIndices.indexOf(id) === -1) continue;
                if (possibleGroups.some(group => group.some(p => p.r === r && p.c === c))) continue;

                let matches = this.model.findMatches(r, c, id, new Set());
                if (matches && matches.length >= currentMinMatch) {
                    possibleGroups.push(matches);
                }
            }
        }

        if (possibleGroups.length > 0) {
            // Выбираем случайную группу из найденных
            let randomGroup = possibleGroups[Math.floor(Math.random() * possibleGroups.length)];
            
            randomGroup.forEach((pos, index) => {
                if (grid[pos.r] && grid[pos.r][pos.c]) {
                    let node = grid[pos.r][pos.c];
                    this.hintNodes.push(node);

                    cc.tween(node)
                        .to(0.4, { scale: 1.1 }, { easing: 'sineInOut' })
                        .to(0.4, { scale: 1.0 }, { easing: 'sineInOut' })
                        .union()
                        .repeat(5) // Попульсируем 3 раза (это займет ~2.4 сек)
                        .call(() => {
                            // Когда закончил пульсировать последний кубик в группе
                            if (index === randomGroup.length - 1) {
                                this.resetTimer(); // Снова запускаем ожидание 5 секунд
                            }
                        })
                        .start();
                }
            });
        } else {
            // Если ходов вообще нет, просто перезапускаем таймер (на случай Shuffle)
            this.resetTimer();
        }
    }
    
    // Мгновенно останавливает анимацию подсказки и возвращает кубики в исходное состояние.
    public stopHint() {
        this.hintNodes.forEach(node => {
            if (node && node.isValid) {
                cc.tween(node).stop();
                node.scale = 1.0;
            }
        });
        this.hintNodes = [];
    }
}