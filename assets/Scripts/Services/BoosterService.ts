/**
 * BoosterService.ts
 * Отвечает за расчет паттернов взрыва для разных типов бустеров.
 */

export interface IPos { r: number; c: number; }

export interface IExplosionResult {
    totalArea: IPos[];            // Все клетки, которые нужно удалить
    activatedBoosters: {r:number, c:number, id:number}[]; // Список всех бустеров в цепочке
}

export default class BoosterService {
    // Константы ID из твоего ТЗ
    public static readonly ROCKET_H = 11;
    public static readonly ROCKET_V = 9;
    public static readonly BOMB = 5;
    public static readonly BOMB_MAX = 6;
    public static readonly COLOR_REMOVER = 13;
    public static readonly RANDOM_SPAWNER = 14;


    /**
     * Возвращает массив координат, которые должен уничтожить бустер
     */
    public static getAffectedArea(id: number, r: number, c: number, gridData: number[][], maxRows: number, maxCols: number): IPos[] {
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
            case this.COLOR_REMOVER:
                // ПАССИВНАЯ ЛОГИКА: если бустер задели взрывом
                // Выбираем случайный цвет из 4-х соседей и удаляем его везде
                const randomNeighborColor = this.getRandomNeighborColor(r, c, gridData, maxRows, maxCols);
                if (randomNeighborColor !== -1) {
                    area = this.getAllTilesOfColor(randomNeighborColor, gridData, maxRows, maxCols);
                }
                // Добавляем сам бустер в зону удаления
                area.push({ r, c });
                break;
        }
        return area;
    }

    /**
     * ЭКСКЛЮЗИВНАЯ ЛОГИКА ДЛЯ КОМБО: Звезда + другой бустер.
     * Этот метод вызывается ТОЛЬКО из режима Color Remover.
     */
    public static getStarComboArea(clickedBoosterId: number, r: number, c: number, rows: number, cols: number): IPos[] {
        let area: IPos[] = [];

        switch (clickedBoosterId) {
            case this.COLOR_REMOVER: // МЕГА КОМБО: Две звезды!
                for (let rr = 0; rr < rows; rr++) {
                    for (let cc = 0; cc < cols; cc++) {
                        area.push({ r: rr, c: cc });
                    }
                }
                break;
            case this.ROCKET_H: 
                // КОМБО: 3 горизонтальных ряда (ряд клика + один выше + один ниже)
                for (let dr = -1; dr <= 1; dr++) {
                    let nr = r + dr;
                    if (nr >= 0 && nr < rows) {
                        for (let cc = 0; cc < cols; cc++) area.push({ r: nr, c: cc });
                    }
                }
                break;

            case this.ROCKET_V: 
                // КОМБО: 3 вертикальных ряда (ряд клика + один слева + один справа)
                for (let dc = -1; dc <= 1; dc++) {
                    let nc = c + dc;
                    if (nc >= 0 && nc < cols) {
                        for (let rr = 0; rr < rows; rr++) area.push({ r: rr, c: nc });
                    }
                }
                break;

            case this.BOMB: 
                // КОМБО: Крест шириной в 3 ряда (радиус 1 от эпицентра)
                this.addMegaCross(area, r, c, 1, rows, cols);
                break;

            case this.BOMB_MAX: 
                // КОМБО: Крест шириной в 5 рядов (радиус 2 от эпицентра)
                this.addMegaCross(area, r, c, 2, rows, cols);
                break;
        }
        return area;
    }

    private static addMegaCross(area: IPos[], r: number, c: number, radius: number, rows: number, cols: number) {
        // 1. Заполняем горизонтальную полосу шириной (radius * 2 + 1)
        for (let dr = -radius; dr <= radius; dr++) {
            let nr = r + dr;
            if (nr >= 0 && nr < rows) {
                for (let cc = 0; cc < cols; cc++) area.push({ r: nr, c: cc });
            }
        }
        // 2. Заполняем вертикальную полосу шириной (radius * 2 + 1)
        for (let dc = -radius; dc <= radius; dc++) {
            let nc = c + dc;
            if (nc >= 0 && nc < cols) {
                for (let rr = 0; rr < rows; rr++) {
                    // Добавляем только если этой точки еще нет (чтобы не дублировать центр)
                    if (!area.some(p => p.r === rr && p.c === nc)) area.push({ r: rr, c: nc });
                }
            }
        }
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
    /**
     * Рассчитывает полную цепочку взрывов
     */
    public static calculateChainExplosion(
        startR: number, 
        startC: number, 
        startId: number, 
        gridData: number[][], 
        rows: number, 
        cols: number
    ): IExplosionResult {
        let toProcess = [{ r: startR, c: startC, id: startId }];
        let totalArea: IPos[] = [];
        let activatedBoosters: {r:number, c:number, id:number}[] = [];
        let processedKeys = new Set<string>();

        while (toProcess.length > 0) {
            let current = toProcess.shift();
            let key = `${current.r},${current.c}`;

            if (processedKeys.has(key)) continue;
            processedKeys.add(key);
            activatedBoosters.push(current);

            // Получаем область поражения конкретно этого бустера
            let area = this.getAffectedArea(current.id, current.r, current.c, gridData, rows, cols);
            
            area.forEach(pos => {
                // Добавляем в общий список уничтожения
                if (!totalArea.some(p => p.r === pos.r && p.c === pos.c)) {
                    totalArea.push(pos);
                }

                // ПРОВЕРКА ЦЕПНОЙ РЕАКЦИИ:
                // Если в зоне взрыва есть другой бустер — добавляем его в очередь
                let targetId = gridData[pos.r][pos.c];
                if (this.isBooster(targetId) && !processedKeys.has(`${pos.r},${pos.c}`)) {
                    toProcess.push({ r: pos.r, c: pos.c, id: targetId });
                }
            });
        }

        return { totalArea, activatedBoosters };
    }


    // логика бустера ремувера цвета
    /**
     * АКТИВНАЯ ЛОГИКА: Находит все плитки конкретного цвета (для GameController)
     */
    public static getAllTilesOfColor(targetColor: number, gridData: number[][], rows: number, cols: number): IPos[] {
        let area: IPos[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (gridData[r][c] === targetColor) {
                    area.push({ r, c });
                }
            }
        }
        return area;
    }

    /**
     * Ищет случайный цвет среди 4-х соседей (для пассивной активации)
     */
    private static getRandomNeighborColor(r: number, c: number, gridData: number[][], rows: number, cols: number): number {
        const neighbors = [
            { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
        ];
        let colors: number[] = [];

        neighbors.forEach(n => {
            let nr = r + n.dr;
            let nc = c + n.dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                let id = gridData[nr][nc];
                if (id !== -1 && !this.isBooster(id)) {
                    colors.push(id);
                }
            }
        });

        if (colors.length === 0) return -1;
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Возвращает случайный ID бустера для спавна палочкой
     */
    public static getRandomBoosterId(): number {
        // Список доступных: Бомба S, Бомба L, Ракета V, Ракета H, Звезда
        const boosterIds = [5, 6, 9, 11, 13];
        return boosterIds[Math.floor(Math.random() * boosterIds.length)];
    }


    public static isBooster(id: number): boolean {
        return [this.BOMB, this.BOMB_MAX, this.ROCKET_H, this.ROCKET_V, this.COLOR_REMOVER].indexOf(id) !== -1;
    }
}