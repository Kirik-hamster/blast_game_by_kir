import { GAME_CONFIG } from "./GameConfig";
import GridModel from "./GridModel";


/**
 * BonusService — сервис для управления фазой (бонусный финал).
 * * ЧТО ЭТО ДЕЛАЕТ:
 * Когда игрок достигает целевого счета, этот сервис берет на себя управление игрой:
 * 1. Конвертация: Превращает каждый неиспользованный ход в случайный бустер на поле.
 * 2. Детонация: По очереди находит и взрывает каждый бустер.
 * 3. Начисление: Позволяет игроку набрать дополнительные очки сверх лимита перед финалом.
 */
export default class BonusService {
    private controller: any = null;
    private model: GridModel = null;

    constructor(controller: any, model: GridModel) {
        this.controller = controller;
        this.model = model;
    }

    // Главный метод: превращаем оставшиеся ходы в бустеры
    public async startWinBonus() {
        // Блокируем клики, чтобы игрок не мешал анимации
        this.controller.fieldBg.pauseSystemEvents(true);

        while (this.controller.currentMoves > 0) {
            this.controller.currentMoves--;
            this.controller.updateUI();

            // Ищем случайную позицию для бустера
            let r = Math.floor(Math.random() * this.model.rows);
            let c = Math.floor(Math.random() * this.model.cols);

            // Проверяем, что в ячейке обычный кубик
            let id = this.model.gridData[r][c];
            if (this.controller.nodesGrid[r][c] && this.controller.blockIndices.indexOf(id) !== -1) {
                let ids = GAME_CONFIG.FEVER_MODE.POSSIBLE_BOOSTERS;
                let randomID = ids[Math.floor(Math.random() * ids.length)];

                this.controller.nodesGrid[r][c].destroy();
                this.controller.spawnBooster(r, c, randomID);
                
                // Задержка между появлениями для визуального эффекта
                await new Promise(resolve => setTimeout(resolve, GAME_CONFIG.FEVER_MODE.SPAWN_DELAY_MS));
            }
        }

        // Когда ходы кончились — запускаем цепную реакцию
        this.activateAllBoostersSequentially();
    }

    // Последовательный взрыв всех бустеров на поле
    private activateAllBoostersSequentially() {
        let boosterPos = null;

        // Сканируем поле на наличие любых бустеров
        for (let r = 0; r < this.model.rows; r++) {
            for (let c = 0; c < this.model.cols; c++) {
                let id = this.model.gridData[r][c];
                if ([5, 6, 9, 11].indexOf(id) !== -1) {
                    boosterPos = { r, c, id };
                    break;
                }
            }
            if (boosterPos) break;
        }

        if (boosterPos) {
            // Взрываем найденный бустер через контроллер
            this.controller.activatePowerUp(boosterPos.r, boosterPos.c, boosterPos.id);
            
            // Ждем завершения анимации и гравитации перед следующим взрывом
            this.controller.scheduleOnce(() => this.activateAllBoostersSequentially(), GAME_CONFIG.FEVER_MODE.EXPLOSION_INTERVAL);
        } else {
            // Бустеров не осталось — показываем финальный экран
            this.controller.scheduleOnce(() => {
                this.controller.showEndGame(true);
            }, GAME_CONFIG.FEVER_MODE.FINAL_UI_DELAY);
        }
    }
}