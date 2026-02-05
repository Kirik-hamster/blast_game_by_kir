/**
 * GridModel.ts
 * * ОТВЕЧАЕТ ЗА:
 * 1. Хранение данных игрового поля (двумерный массив ID).
 * 2. Алгоритмы поиска совпадений (Blast-механика).
 * 3. Логическую проверку состояния игры (есть ли ходы, победа/проигрыш).
 */
export default class GridModel {
    public rows: number = 10;
    public cols: number = 9;
    public gridData: number[][] = []; // Храним только ID цветов/типов

    constructor(rows: number, cols: number) {
        this.rows = rows;
        this.cols = cols;
    }

    // Инициализация пустой сетки
    public initGrid() {
        this.gridData = [];
        for (let r = 0; r < this.rows; r++) {
            this.gridData[r] = [];
        }
    }

    // Логическая проверка координат
    public isPosValid(r: number, c: number): boolean {
        return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
    }

    // Алгоритм поиска совпадений (возвращает только координаты {r, c})
    public findMatches(r: number, c: number, targetID: number, visited: Set<string> = new Set()): {r: number, c: number}[] {
        let key = `${r},${c}`;
        if (!this.isPosValid(r, c) || visited.has(key) || this.gridData[r][c] !== targetID) {
            return [];
        }

        visited.add(key);
        let res = [{r, c}];
        
        // Рекурсивный поиск по соседям
        res.push(...this.findMatches(r + 1, c, targetID, visited));
        res.push(...this.findMatches(r - 1, c, targetID, visited));
        res.push(...this.findMatches(r, c + 1, targetID, visited));
        res.push(...this.findMatches(r, c - 1, targetID, visited));
        
        return res;
    }

    // Проверка на наличие хотя бы одного возможного хода
    public hasPossibleMatches(blockIndices: number[], minMatchSize: number): boolean {
        // Храним координаты, которые мы уже проверили в этом цикле
        let checkedCoordinates = new Set<string>();

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let key = `${r},${c}`;
                
                // Если мы уже проверяли этот кубик в составе какой-то группы, пропускаем
                if (checkedCoordinates.has(key)) continue;

                let id = this.gridData[r][c];

                // Если это бустер (его нет в списке обычных блоков) — ход точно есть
                if (blockIndices.indexOf(id) === -1) {
                    return true;
                }

                // Используем наш DFS для поиска всей группы
                // Важно: передаем новый Set, чтобы findMatches отработал корректно
                let group = this.findMatches(r, c, id, new Set());

                // Если группа подходит под размер из конфига — ура, ход есть
                if (group.length >= minMatchSize) {
                    return true;
                }

                // Чтобы не проверять каждый кубик этой (маленькой) группы заново, 
                // помечаем их все как "обработанные"
                group.forEach(pos => checkedCoordinates.add(`${pos.r},${pos.c}`));
            }
        }
        
        // Если прошли всё поле и не нашли ни бустеров, ни групп нужного размера
        return false;
    }
    
    /**
     * Умный выбор цвета для предотвращения скучных паттернов
     */
    public getSmartColor(r: number, c: number, blockIndices: number[]): number {
        let neighbors = [];
        if (r > 0 && this.gridData[r - 1][c] !== undefined) neighbors.push(this.gridData[r - 1][c]);
        if (c > 0 && this.gridData[r][c - 1] !== undefined) neighbors.push(this.gridData[r][c - 1]);

        // С шансом 60% создаем группу, подражая соседу
        if (neighbors.length > 0 && Math.random() < 0.6) {
            let color = neighbors[Math.floor(Math.random() * neighbors.length)];
            if (color !== -1) return color;
        }
        return blockIndices[Math.floor(Math.random() * blockIndices.length)];
    }

    /**
     * Перемешивает все существующие ID в сетке (не трогает пустые клетки -1)
     */
    public shuffleGrid() {
        let allIDs = [];
        
        // 1. Собираем все текущие ID кубиков и бустеров
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.gridData[r][c] !== -1) {
                    allIDs.push(this.gridData[r][c]);
                }
            }
        }

        // 2. Перемешиваем массив методом Фишера-Йейтса
        for (let i = allIDs.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [allIDs[i], allIDs[j]] = [allIDs[j], allIDs[i]];
        }

        // 3. Записываем перемешанные ID обратно в те же ячейки
        let counter = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.gridData[r][c] !== -1) {
                    this.gridData[r][c] = allIDs[counter++];
                }
            }
        }
    }
}