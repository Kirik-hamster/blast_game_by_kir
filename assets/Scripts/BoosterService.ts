/**
 * BoosterService.ts
 * Отвечает за расчет паттернов взрыва для разных типов бустеров.
 */

export interface IPos { r: number; c: number; }

export default class BoosterService {
    // Константы ID из твоего ТЗ
    public static readonly ROCKET_H = 11;
    public static readonly ROCKET_V = 9;
    public static readonly BOMB = 5;
    public static readonly BOMB_MAX = 6;

    /**
     * Возвращает массив координат, которые должен уничтожить бустер
     */
    public static getAffectedArea(id: number, r: number, c: number, maxRows: number, maxCols: number): IPos[] {
        let area: IPos[] = [];

        switch (id) {
            case this.ROCKET_H: // Горизонтальная ракета
                for (let i = 0; i < maxCols; i++) area.push({ r, c: i });
                break;

            case this.ROCKET_V: // Вертикальная ракета
                for (let i = 0; i < maxRows; i++) area.push({ r: i, c });
                break;

            case this.BOMB: // Бомба 3x3 (центр + соседи)
                // Маленькая бомба: 3x3 гарантированно (радиус 1) 
                // + 5 случайных в области 5x5 (радиус 2)
                this.addFixedArea(area, r, c, 1, maxRows, maxCols);
                this.addRandomPositions(area, r, c, 2, 2, 5, maxRows, maxCols);
                break;

            case this.BOMB_MAX: // Супер-бомба 7x7
                // Большая бомба: 5x5 гарантированно (радиус 2) 
                // + 10 случайных в области 7x7 (радиус 3)
                this.addFixedArea(area, r, c, 2, maxRows, maxCols);
                this.addRandomPositions(area, r, c, 3, 3, 10, maxRows, maxCols);
                break;
        }
        return area;
    }

    /**
     * Заполняет область фиксированным квадратом вокруг центра
     */
    private static addFixedArea(area: IPos[], r: number, c: number, radius: number, maxRows: number, maxCols: number) {
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                let nr = r + dr;
                let nc = c + dc;
                if (nr >= 0 && nr < maxRows && nc >= 0 && nc < maxCols) {
                    area.push({ r: nr, c: nc });
                }
            }
        }
    }

    /**
     * Добавляет случайные позиции, исключая те, что уже есть в списке взрыва
     */
    private static addRandomPositions(currentArea: IPos[], r: number, c: number, radiusR: number, radiusC: number, count: number, maxRows: number, maxCols: number) {
        let candidates: IPos[] = [];

        // Собираем все возможные координаты в заданном радиусе, которых еще нет в списке взрыва
        for (let dr = -radiusR; dr <= radiusR; dr++) {
            for (let dc = -radiusC; dc <= radiusC; dc++) {
                let nr = r + dr;
                let nc = c + dc;

                // Проверяем границы поля
                if (nr >= 0 && nr < maxRows && nc >= 0 && nc < maxCols) {
                    // Проверяем, нет ли этой точки уже в основном списке взрыва
                    const exists = currentArea.some(pos => pos.r === nr && pos.c === nc);
                    if (!exists) {
                        candidates.push({ r: nr, c: nc });
                    }
                }
            }
        }

        // Выбираем N случайных из списка кандидатов
        for (let i = 0; i < count && candidates.length > 0; i++) {
            let randomIndex = Math.floor(Math.random() * candidates.length);
            let chosenPos = candidates.splice(randomIndex, 1)[0];
            currentArea.push(chosenPos);
        }
    }
}