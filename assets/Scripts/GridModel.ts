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
}