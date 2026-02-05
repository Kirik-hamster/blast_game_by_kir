const {ccclass} = cc._decorator;

@ccclass
export default class FieldManager {
    // Теперь главный массив с объектами живет здесь
    public nodesGrid: cc.Node[][] = [];
    private controller: any = null;

    public rows: number = 10;
    public cols: number = 9;
    public spacingX: number = 100;
    public spacingY: number = 100;

    constructor(controller: any) {
        this.controller = controller;
    }

    /**
     * УНИВЕРСАЛЬНЫЙ МЕТОД: Создание любого объекта на поле (кубик или бустер).
     * Он отвечает ТОЛЬКО за визуал и хранение ссылки в массиве.
     */
    public createNodeAt(r: number, c: number, id: number): cc.Node {
        let node = cc.instantiate(this.controller.tilePrefab);
        node.parent = this.controller.fieldBg;
        node.setContentSize(100, 112);

        // Расчет позиции
        const x = (c - (this.cols - 1) / 2) * this.spacingX;
        const y = (r - (this.rows - 1) / 2) * this.spacingY;
        node.setPosition(x, y);

        // Установка текстуры
        let sprite = node.getComponent(cc.Sprite);
        if (sprite && this.controller.tileTextures[id]) {
            sprite.spriteFrame = this.controller.tileTextures[id];
        }
        
        // Кастомное свойство для логики (если нужно)
        node["colorID"] = id;

        // Привязка клика обратно в контроллер
        node.on(cc.Node.EventType.TOUCH_END, () => this.controller.onTileClick(r, c));

        // Сохраняем в наш "склад"
        this.nodesGrid[r][c] = node;

        return node;
    }
    /** * МЕТОД: Массовое удаление кубиков с поля.
     * Принимает массив координат [{r, c}, {r, c}...]
     */
    public destroyTiles(positions: {r: number, c: number}[]) {
        positions.forEach(pos => {
            // Ищем ноду в нашем менеджере
            let tileNode = this.nodesGrid[pos.r][pos.c];
            
            if (tileNode) {
                tileNode.destroy(); // Удаляем со сцены
                this.nodesGrid[pos.r][pos.c] = null; // Стираем ссылку в массиве
            }
        });
    }

    /**
     * МЕТОД: Гравитация.
     * Перемещает кубики вниз и заполняет пустые места сверху.
     * @param onComplete - функция-уведомление для контроллера.
     */
    public applyGravity(onComplete: Function) {
        for (let c = 0; c < this.cols; c++) {
            let emptyCount = 0;
            for (let r = 0; r < this.rows; r++) {
                if (this.nodesGrid[r][c] === null) {
                    emptyCount++;
                } else if (emptyCount > 0) {
                    let tile = this.nodesGrid[r][c];
                    let newR = r - emptyCount;

                    // Синхронизируем массив нод
                    this.nodesGrid[newR][c] = tile;
                    this.nodesGrid[r][c] = null;
                    
                    // Синхронизируем Модель данных через ссылку на контроллер
                    this.controller.model.gridData[newR][c] = this.controller.model.gridData[r][c];
                    this.controller.model.gridData[r][c] = -1;

                    // Анимация падения (используем свои spacingY)
                    let newY = (newR - (this.rows - 1) / 2) * this.spacingY;
                    cc.tween(tile).to(0.3, { y: newY }, { easing: 'bounceOut' }).start();
                    
                    // Обновляем координаты в обработчике клика
                    tile.off(cc.Node.EventType.TOUCH_END);
                    tile.on(cc.Node.EventType.TOUCH_END, () => this.controller.onTileClick(newR, c));
                }
            }
            this.fillEmptyTop(c, emptyCount);
        }
        
        // Даем анимации 0.4 сек и сообщаем контроллеру: "Готово, проверяй!"
        this.controller.scheduleOnce(() => onComplete(), 0.4);
    }

    private fillEmptyTop(c: number, count: number) {
        for (let i = 0; i < count; i++) {
            let r = this.rows - count + i;
            
            // Пользуемся нашим новым универсальным методом
            // Сначала создаем данные в модели
            let colorIdx = this.controller.blockIndices[Math.floor(Math.random() * this.controller.blockIndices.length)];
            this.controller.model.gridData[r][c] = colorIdx;

            // Рисуем ноду
            let newTile = this.createNodeAt(r, c, colorIdx);
            
            // Ставим её визуально ВЫШЕ поля для эффекта падения
            let targetY = newTile.y;
            newTile.y = ((this.rows + i) - (this.rows - 1) / 2) * this.spacingY;
            
            cc.tween(newTile).to(0.3, { y: targetY }, { easing: 'bounceOut' }).start();
        }
    }

    /**
     * Визуальный эффект тряски узла (поля или всего интерфейса)
     */
    public shake(target: cc.Node, intensity: number = 10) {
        if (!target) return;
        let originalPos = target.getPosition();
        
        cc.tween(target)
            .to(0.05, { position: cc.v3(originalPos.x + intensity, originalPos.y + intensity, 0) })
            .to(0.05, { position: cc.v3(originalPos.x - intensity, originalPos.y - intensity, 0) })
            .to(0.05, { position: cc.v3(originalPos.x + intensity, originalPos.y - intensity, 0) })
            .to(0.05, { position: cc.v3(originalPos.x, originalPos.y, 0) })
            .start();
    }

    /**
     * Анимация "закручивания" всех кубиков при перемешивании
     * @param onSwapData Колбэк, который вызывается, когда кубики сжались до 0
     */
    public animateShuffle(onSwapData: Function) {
        let allNodes: cc.Node[] = [];
        
        // Собираем все существующие ноды
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.nodesGrid[r][c]) {
                    allNodes.push(this.nodesGrid[r][c]);
                }
            }
        }

        // Анимируем каждую ноду
        allNodes.forEach((node, index) => {
            cc.tween(node)
                .to(1.2, { scale: 0, angle: 360 }, { easing: 'backIn' }) // Схлопываем и крутим
                .delay(0.4)
                .call(() => {
                    // Выполняем подмену данных и спрайтов только один раз (для первой ноды)
                    if (index === 0 && onSwapData) onSwapData();
                })
                .to(1.0, { scale: 1, angle: 0 }, { easing: 'backOut' }) // Возвращаем в норму
                .start();
        });
    }
    
}