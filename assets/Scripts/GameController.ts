import GridModel from "./GridModel";
import BoosterService from "./BoosterService";
import HintService from "./HintService";
import BonusService from "./BonusService";
import { GAME_CONFIG } from "./GameConfig";

const {ccclass, property} = cc._decorator;

@ccclass
export default class GameController extends cc.Component {

    // >>> ВСЕ ЗВУКИ <<<
    @property(cc.AudioClip) soundSmall: cc.AudioClip = null; // Большой кубический лопание
    @property(cc.AudioClip) soundBig: cc.AudioClip = null; // Маленький кубическое лопание
    @property(cc.AudioClip) rocket: cc.AudioClip = null; 
    @property(cc.AudioClip) bombSmall: cc.AudioClip = null;    
    @property(cc.AudioClip) bombBig: cc.AudioClip = null;
    @property(cc.AudioClip) soundWin: cc.AudioClip = null;  // Мелодия победы
    @property(cc.AudioClip) soundLose: cc.AudioClip = null; // Мелодия проигрыша
    @property(cc.AudioClip) soundShuffle: cc.AudioClip = null; // звук перемешивания кубиков

    // >>> UI ЭЛЕМЕНТЫ <<<
    @property(cc.Node) gameplayUI: cc.Node = null; // Узел со всей игрой
    @property(cc.Node) endGameUI: cc.Node = null;   // Весь узел EndGameUI
    @property(cc.Label) endGameLable: cc.Label = null;
    @property(cc.Node) restartButtonNode: cc.Node = null;
    @property(cc.Label) ScoreCount: cc.Label = null;
    @property(cc.Label) movesLabel: cc.Label = null;
    @property(cc.Label) endGameScoreLabel: cc.Label = null;

    // >>> БУСТЕРЫ И ПОЛЕ <<<
    @property(cc.Prefab) tilePrefab: cc.Prefab = null; 
    @property(cc.Node) fieldBg: cc.Node = null; 
    @property([cc.SpriteFrame]) tileTextures: cc.SpriteFrame[] = []; 
    @property(cc.Node) btnTeleport: cc.Node = null;
    @property(cc.Node) btnRandomBomb: cc.Node = null;
    @property(cc.Label) teleportLabel: cc.Label = null;
    @property(cc.Label) boosterBombLabel: cc.Label = null;

    private model: GridModel = null;
    private hintService: HintService = null;
    private bonusService: BonusService = null;
    private nodesGrid: cc.Node[][] = [];

    // НАСТРОЙКИ БАЛАНСА
    private currentMoves: number = GAME_CONFIG.START_MOVES;
    private teleportCount: number = GAME_CONFIG.INITIAL_TELEPORT_COUNT;
    private boosterBombCount: number = GAME_CONFIG.INITIAL_BOMB_COUNT;
    private currentScore: number = 0;
    private targetScore: number = GAME_CONFIG.TARGET_SCORE;

    private isTeleportActive: boolean = false; 
    private firstSelectedTile: { r: number, c: number, node: cc.Node } = null;
    private autoShuffleCount: number = 0;

    private rows: number = 10;
    private cols: number = 9;
    private spacingX: number = 100;
    private spacingY: number = 100;
    
    // Индексы из твоего массива
    private blockIndices: number[] = [4, 7, 8, 10, 12];
    private rocketIndices: number[] = [9, 11]; // Ракеты
    private bombIdx: number = 5;
    private maxBombIdx: number = 6;

    private isEndingStarted: boolean = false;

    start() {
        this.isEndingStarted = false;
        this.model = new GridModel(this.rows, this.cols);
        this.bonusService = new BonusService(this, this.model);
        this.hintService = new HintService(this, this.model, this.blockIndices);
        if (this.gameplayUI) this.gameplayUI.active = true;
        if (this.endGameUI) this.endGameUI.active = false;
        this.updateUI();
        this.generateField();
        this.setupEventListeners(); 
        this.hintService.resetTimer();
    }

    setupEventListeners() {
        // >>> БУСТЕР ТЕЛЕПОРТ <<<
        if (this.btnTeleport) {
            this.btnTeleport.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
                if (this.teleportCount <= 0) return;

                if (this.isTeleportActive) {
                    // ПОВТОРНОЕ НАЖАТИЕ: ОТМЕНА
                    this.isTeleportActive = false;
                    this.btnTeleport.color = cc.Color.WHITE;
                    
                    if (this.firstSelectedTile) {
                        cc.tween(this.firstSelectedTile.node).to(0.1, { scale: 1 }).start();
                        this.firstSelectedTile = null;
                    }
                    cc.log("ТЕЛЕПОРТ: Режим отменен игроком");
                } else {
                    // ПЕРВОЕ НАЖАТИЕ: ВКЛЮЧЕНИЕ
                    this.isTeleportActive = true;
                    this.btnTeleport.color = cc.Color.YELLOW;
                    cc.log("ТЕЛЕПОРТ: Выберите первый тайл");
                }
                event.stopPropagation();
            });
        }

        // >>> БУСТЕР СЛУЧАЙНАЯ БОМБА <<<
        if (this.btnRandomBomb) {
            this.btnRandomBomb.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
                if (this.boosterBombCount > 0) {
                    // ПОДСВЕЧИВАЕМ КНОПКУ ПЕРЕД АКТИВАЦИЕЙ
                    this.btnRandomBomb.color = cc.Color.YELLOW;
                    
                    // Чтобы игрок увидел вспышку, возвращаем цвет через мгновение
                    this.scheduleOnce(() => {
                        this.useRandomBombBooster();
                        if (this.boosterBombCount > 0) {
                            this.btnRandomBomb.color = cc.Color.WHITE;
                        }
                    }, 0.1);
                }
                event.stopPropagation();
            });
        }

        if (this.restartButtonNode) {
            this.restartButtonNode.on(cc.Node.EventType.TOUCH_END, () => this.restartGame());
        }
    }

    // Логика обмена тайлов местами
    handleTeleportSwap(r: number, c: number) {
        let clickedNode = this.nodesGrid[r][c];

        // 1. ВЫБОР ПЕРВОГО ТАЙЛА
        if (!this.firstSelectedTile) {
            this.firstSelectedTile = { r, c, node: clickedNode };
            
            // КУБИК УВЕЛИЧИВАЕТСЯ И ОСТАЕТСЯ БОЛЬШИМ 
            cc.tween(clickedNode).to(0.15, { scale: 1.2 }).start();
            
            cc.log("Первый кубик зафиксирован. Ждем второй.");
            return;
        }

        // 2. ВЫБОР ВТОРОГО ТАЙЛА И ОБМЕН
        let tile1 = this.firstSelectedTile;
        
        // Если кликнули на тот же самый кубик — отменяем всё
        if (tile1.r === r && tile1.c === c) {
            cc.tween(tile1.node).to(0.1, { scale: 1 }).start();
            this.btnTeleport.color = cc.Color.WHITE;
            this.firstSelectedTile = null;
            this.isTeleportActive = false; // Выключаем режим телепорта
            cc.log("Телепорт отменен");
            return;
        }

        // Обмен данными в модели данных
        let tempID = this.model.gridData[tile1.r][tile1.c];
        this.model.gridData[tile1.r][tile1.c] = this.model.gridData[r][c];
        this.model.gridData[r][c] = tempID;

        // Визуальная анимация обмена позициями
        let pos1 = tile1.node.getPosition();
        let pos2 = clickedNode.getPosition();

        // Анимируем перемещение и возвращаем масштаб первого кубика в норму
        cc.tween(tile1.node).to(0.3, { x: pos2.x, y: pos2.y, scale: 1 }).start();
        cc.tween(clickedNode).to(0.3, { x: pos1.x, y: pos1.y }).start();

        // Обмен ссылками в массиве узлов (View)
        this.nodesGrid[tile1.r][tile1.c] = clickedNode;
        this.nodesGrid[r][c] = tile1.node;

        // ВАЖНО: Обновляем обработчики клика, так как координаты кубиков изменились
        tile1.node.off(cc.Node.EventType.TOUCH_END);
        clickedNode.off(cc.Node.EventType.TOUCH_END);
        
        // Привязываем новые координаты к старым нодам
        tile1.node.on(cc.Node.EventType.TOUCH_END, () => this.onTileClick(r, c));
        clickedNode.on(cc.Node.EventType.TOUCH_END, () => this.onTileClick(tile1.r, tile1.c));

        // Завершаем работу бустера
        this.teleportCount--;
        this.isTeleportActive = false;
        if (this.btnTeleport) this.btnTeleport.color = cc.Color.WHITE;
        this.firstSelectedTile = null;
        this.updateUI();
        
        // Проверяем, не создали ли мы комбинацию этим обменом
        this.scheduleOnce(() => this.checkGameState(), 0.4);
    }

    generateField() {
        this.model.initGrid();
        this.nodesGrid.length = 0;
        this.fieldBg.removeAllChildren();
        for (let r = 0; r < this.rows; r++) {
            this.nodesGrid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.spawnTile(r, c);
            }
        }
    }

    // Создание одной плитки в заданных координатах
    spawnTile(r: number, c: number) {
        let newTile = cc.instantiate(this.tilePrefab);
        newTile.parent = this.fieldBg;
        newTile.setContentSize(100, 112);

        let colorIdx = this.getSmartColor(r, c);
        
        // Синхронизируем Модель и Вид
        this.model.gridData[r][c] = colorIdx; 
        newTile["colorID"] = colorIdx;

        newTile.setPosition((c - (this.cols - 1) / 2) * 100, (r - (this.rows - 1) / 2) * 100);
        newTile.getComponent(cc.Sprite).spriteFrame = this.tileTextures[colorIdx];
        newTile.on(cc.Node.EventType.TOUCH_END, () => this.onTileClick(r, c));

        this.nodesGrid[r][c] = newTile;
    }

    // Обработка нажатия на плитку
    onTileClick(r: number, c: number) {
        if (this.hintService) this.hintService.resetTimer();
        if (this.isTeleportActive) {
            this.handleTeleportSwap(r, c);
            return; 
        }

        let id = this.model.gridData[r][c];
        let matches = this.model.findMatches(r, c, id);

        // Если нажали на бустер активируем спец-логику
        if (this.rocketIndices.indexOf(id) !== -1 || id === this.bombIdx || id === this.maxBombIdx) {
            this.activatePowerUp(r, c, id);
            return;
        }

        // визуальный эффект: Увеличиваем всю группу совпавших тайлов
        matches.forEach(pos => {
            let node = this.nodesGrid[pos.r][pos.c];
            if (node) {
                // Быстрое увеличение и возврат, создающее эффект «пуп!»
                cc.tween(node)
                    .to(0.05, { scale: 1.1 })
                    .to(0.05, { scale: 1.0 })
                    .start();
            }
        });

        if (matches.length < GAME_CONFIG.MIN_MATCH_SIZE) return;
        this.scheduleOnce(() => {
            if (matches.length > 5) {
                cc.audioEngine.playEffect(this.soundBig, false); // Звук для большой группы
            } else {
                cc.audioEngine.playEffect(this.soundSmall, false); // Звук для обычной группы
            }

            this.currentMoves--;
            this.currentScore += matches.length * GAME_CONFIG.POINTS_PER_NORMAL_TILE;

            // Удаляем ноды на основе координат из модели
            matches.forEach(pos => {
                let tileNode = this.nodesGrid[pos.r][pos.c];
                if (tileNode) {
                    tileNode.destroy();
                    this.nodesGrid[pos.r][pos.c] = null;
                    this.model.gridData[pos.r][pos.c] = -1; // Очищаем данные
                }
            });

            // Проверка на создание нового бустера после хода
            let boosterToSpawn = -1;

            if (matches.length >= GAME_CONFIG.THRESHOLDS.ROCKET.min && matches.length <= GAME_CONFIG.THRESHOLDS.ROCKET.max) {
                boosterToSpawn = this.rocketIndices[Math.floor(Math.random() * 2)];
            } else if (matches.length >= GAME_CONFIG.THRESHOLDS.BOMB_SMALL.min && matches.length <= GAME_CONFIG.THRESHOLDS.BOMB_SMALL.max) {
                boosterToSpawn = this.bombIdx;
            } else if (matches.length >= 12) {
                boosterToSpawn = this.maxBombIdx;
            }

            // Если условия выполнены, спавним бустер в точку клика [r, c]
            if (boosterToSpawn !== -1) {
                this.spawnBooster(r, c, boosterToSpawn);
            }

            this.updateUI();
            this.scheduleOnce(() => this.applyGravity(), GAME_CONFIG.GRAVITY_DELAY);
        }, 0.1);
    }  
    
    // Проверка условий победы или поражения
    checkGameState() {
        if (this.isEndingStarted) return;
        if (this.currentScore >= this.targetScore) {
            this.bonusService.startWinBonus();
            return;
        }
        const hasMovesOnBoard = this.model.hasPossibleMatches(this.blockIndices, GAME_CONFIG.MIN_MATCH_SIZE);
        if (!hasMovesOnBoard) {
            // Если ходов нет, проверяем, не исчерпан ли лимит ШАФЛОВ
            if (this.autoShuffleCount < GAME_CONFIG.AUTO_SHUFFLE_LIMIT) {
                this.autoShuffleCount++;
                this.executeShuffleLogic();
                
                // Ждем 3 секунды (пока закончится вся анимация), 
                // прежде чем проверять состояние игры снова!
                this.scheduleOnce(() => this.checkGameState(), 3.0); 
                return;
            } else {
                // Если перемешивания кончились - проигрыш
                this.showEndGame(false);
                return;
            }
        }
        if (this.currentMoves <= 0) {
            this.showEndGame(false);
        }     
    }

    // Логика перемешивания 
    executeShuffleLogic() {
        if (this.soundShuffle) {
            cc.audioEngine.playEffect(this.soundShuffle, false);
        }

        // Собираем все ноды в один массив, чтобы удобнее было анимировать
        let allNodes: cc.Node[] = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.nodesGrid[r][c]) allNodes.push(this.nodesGrid[r][c]);
            }
        }

        // анимация закручивания исчезновения
        // Длительность: 1.2 секунды
        allNodes.forEach(node => {
            cc.tween(node)
                .to(1.2, { scale: 0, angle: 720 }, { easing: 'backIn' }) // Уменьшаем и крутим 2 раза (360 * 2)
                .delay(0.2) // Короткая пауза, пока они невидимы
                .to(1.3, { scale: 1, angle: 0 }, { easing: 'backOut' })  // Возвращаем масштаб и угол
                .start();
        });
        this.scheduleOnce(() => {
            let allIDs = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.nodesGrid[r][c]) allIDs.push(this.model.gridData[r][c]);
                }
            }
            for (let i = allIDs.length - 1; i > 0; i--) {
                let j = Math.floor(Math.random() * (i + 1));
                [allIDs[i], allIDs[j]] = [allIDs[j], allIDs[i]];
            }
            let counter = 0;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.nodesGrid[r][c]) {
                        let newID = allIDs[counter++];
                        this.model.gridData[r][c] = newID;
                        this.nodesGrid[r][c].getComponent(cc.Sprite).spriteFrame = this.tileTextures[newID];
                    }
                }
            }
        }, 1.3)
    }

    // Метод для показа финала
    showEndGame(isWin: boolean) {
        if (this.endGameUI && this.endGameUI.active) return;
        if (isWin) {
            cc.audioEngine.playEffect(this.soundWin, false);
        } else {
            cc.audioEngine.playEffect(this.soundLose, false);
        }
        if (this.gameplayUI) this.gameplayUI.active = false;
        if (this.endGameUI) this.endGameUI.active = true;
        if (this.endGameLable) {
            this.endGameLable.string = isWin ? "Вы победили, хотите \n начать новую игру?" : "Вы проиграли, хотите \n начать новую игру?";
        }
        if (this.endGameScoreLabel) {
            this.endGameScoreLabel.string = `${this.currentScore}/${this.targetScore}`;
        }
    }

    // Метод для кнопки "ДА" (сброс игры)
    restartGame() {
        // Перезагружаем текущую сцену целиком
        cc.director.loadScene(cc.director.getScene().name);
    }

    // Метод для обновления текста на экране
    updateUI() {
        if (this.ScoreCount) this.ScoreCount.string = `${this.currentScore}/${this.targetScore}`;
        if (this.movesLabel) this.movesLabel.string = this.currentMoves.toString();
        if (this.teleportLabel) this.teleportLabel.string = this.teleportCount.toString();
        if (this.boosterBombLabel) this.boosterBombLabel.string = this.boosterBombCount.toString();
        // кончились бустры, меняем отображение
        if (this.btnTeleport && this.teleportCount <= 0) {
            this.btnTeleport.opacity = 150; // полупрозрачная
            this.btnTeleport.color = cc.Color.GRAY;
        }
        if (this.btnRandomBomb && this.boosterBombCount <= 0) {
            this.btnRandomBomb.opacity = 150; // полупрозрачная
            this.btnRandomBomb.color = cc.Color.GRAY;
        }
        
    }

    // Умный выбор цвета для предотвращения скучных паттернов при спавне
    getSmartColor(r: number, c: number) {
        let neighbors = [];
        if (r > 0 && this.model.gridData[r-1][c] !== undefined) neighbors.push(this.model.gridData[r-1][c]);
        if (c > 0 && this.model.gridData[r][c-1] !== undefined) neighbors.push(this.model.gridData[r][c-1]);

        if (neighbors.length > 0 && Math.random() < 0.6) {
            return neighbors[Math.floor(Math.random() * neighbors.length)];
        }
        return this.blockIndices[Math.floor(Math.random() * this.blockIndices.length)];
    }

    // помощь бустер  перемешка
    useShuffleBooster() {
        if (this.teleportCount <= 0) return;
        let allIDs = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.nodesGrid[r][c]) allIDs.push(this.model.gridData[r][c]);
            }
        }
        for (let i = allIDs.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [allIDs[i], allIDs[j]] = [allIDs[j], allIDs[i]];
        }
        let counter = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.nodesGrid[r][c]) {
                    let newID = allIDs[counter++];
                    this.model.gridData[r][c] = newID;
                    this.nodesGrid[r][c].getComponent(cc.Sprite).spriteFrame = this.tileTextures[newID];
                }
            }
        }
        this.teleportCount--;
        this.updateUI();
    }

    // помощь бустер бомбы
    useRandomBombBooster() {
        if (this.boosterBombCount <= 0) return;
        // если был включен телепорт выключаем его при выборе бомбы
        if (this.isTeleportActive) {
            this.isTeleportActive = false;
            if (this.btnTeleport) this.btnTeleport.color = cc.Color.WHITE;
            if (this.firstSelectedTile) {
                cc.tween(this.firstSelectedTile.node).to(0.1, { scale: 1 }).start();
                this.firstSelectedTile = null;
            }
        }
        let r = Math.floor(Math.random() * this.rows);
        let c = Math.floor(Math.random() * this.cols);
        if (this.nodesGrid[r][c]) {
            this.nodesGrid[r][c].destroy();
            this.spawnBooster(r, c, this.bombIdx);
            this.boosterBombCount--;
            this.updateUI();
        }
    }

    // Вспомогательная функция для удаления из сетки
    removeTileFromGrid(tile: cc.Node) {
        for(let r = 0; r < this.rows; r++) {
            let c = this.nodesGrid[r].indexOf(tile);
            if(c !== -1) { 
                this.nodesGrid[r][c] = null; 
                this.model.gridData[r][c] = -1;
                return; 
            }
        }
    }

    // Создание бустера (ракета/бомба) в конкретной позиции
    spawnBooster(r: number, c: number, id: number) {
        let booster = cc.instantiate(this.tilePrefab);
        booster.parent = this.fieldBg;
        booster.setContentSize(100, 112);
        booster["colorID"] = id;
        this.model.gridData[r][c] = id;
        if (this.soundSmall) {
            cc.audioEngine.playEffect(this.soundSmall, false);
        }
        booster.setPosition((c - (this.cols - 1) / 2) * this.spacingX, (r - (this.rows - 1) / 2) * this.spacingY);
        booster.getComponent(cc.Sprite).spriteFrame = this.tileTextures[id];
        booster.on(cc.Node.EventType.TOUCH_END, () => this.onTileClick(r, c));
        this.nodesGrid[r][c] = booster;
    }

    // Проигрывает звук в зависимости от ID бустера
    private playBoosterSfx(id: number) {
        if (this.rocketIndices.indexOf(id) !== -1) {
            cc.audioEngine.playEffect(this.rocket, false);
        } else if (id === this.bombIdx) {
            cc.audioEngine.playEffect(this.bombSmall, false);
        } else if (id === this.maxBombIdx) {
            cc.audioEngine.playEffect(this.bombBig, false);
        }
    }

    shakeNode(target: cc.Node, intensity: number = 10) {
        if (!target) return;

        let originalPos = target.getPosition();
        
        cc.tween(target)
            .to(0.05, { position: cc.v3(originalPos.x + intensity, originalPos.y + intensity, 0) })
            .to(0.05, { position: cc.v3(originalPos.x - intensity, originalPos.y - intensity, 0) })
            .to(0.05, { position: cc.v3(originalPos.x + intensity, originalPos.y - intensity, 0) })
            .to(0.05, { position: cc.v3(originalPos.x, originalPos.y, 0) })
            .start();
    }

    // Активация бустера с поддержкой цепных реакций
    activatePowerUp(r: number, c: number, id: number) {
        let toProcess = [{ r, c, id }]; // Очередь бустеров для активации
        let totalToDestroy: { r: number, c: number }[] = []; // Итоговый список на удаление
        let processedBoosters = new Set<string>(); // Чтобы не активировать один и тот же бустер дважды

        if (id === 9 || id === 11) {
            cc.audioEngine.playEffect(this.rocket, false);
        } else if (id === this.bombIdx) {
            cc.audioEngine.playEffect(this.bombSmall, false);
        } else if (id === this.maxBombIdx) {
            cc.audioEngine.playEffect(this.bombBig, false);
        }

        while (toProcess.length > 0) {
            let current = toProcess.shift();
            let key = `${current.r},${current.c}`;
            
            if (processedBoosters.has(key)) continue;
            processedBoosters.add(key);

            if (current.id === this.bombIdx) {
                this.shakeNode(this.fieldBg, 10);
            } else if (current.id === this.maxBombIdx) {
                this.shakeNode(this.gameplayUI, 30);
            }
            

            this.playBoosterSfx(current.id);
            // Получаем область поражения для текущего бустера из сервиса
            let area = BoosterService.getAffectedArea(current.id, current.r, current.c, this.rows, this.cols);
            area.forEach(pos => {
                if (this.model.isPosValid(pos.r, pos.c)) {
                    // Добавляем в список на удаление, если еще не там
                    if (!totalToDestroy.some(p => p.r === pos.r && p.c === pos.c)) {
                        totalToDestroy.push(pos);
                    }
                    // Если в зоне взрыва есть другой бустер, добавляем его в очередь
                    let targetID = this.model.gridData[pos.r][pos.c];
                    let isRocket = this.rocketIndices.indexOf(targetID) !== -1;
                    let isBomb = targetID === this.bombIdx || targetID === this.maxBombIdx;

                    if ((isRocket || isBomb) && !processedBoosters.has(`${pos.r},${pos.c}`)) {
                        toProcess.push({ r: pos.r, c: pos.c, id: targetID });
                    }
                }
            });
        }

        // Звук и визуальное удаление
        if (totalToDestroy.length > 0) {
            // В цикле только удаляем объекты
            totalToDestroy.forEach(pos => {
                this.currentScore += GAME_CONFIG.BOOSTER_EXPLOSION_DIVIDER;
                let tileNode = this.nodesGrid[pos.r][pos.c];
                if (tileNode) {
                    tileNode.destroy();
                    this.nodesGrid[pos.r][pos.c] = null;
                    this.model.gridData[pos.r][pos.c] = -1;
                }
            });
        }
        this.updateUI();
        this.scheduleOnce(() => this.applyGravity(), 0.1);
    }

    // Метод для добавления случайных целей в массив взрыва
    addRandomTargets(r: number, c: number, radius: number, count: number, list: cc.Node[]) {
        let candidates = [];
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                let nr = r + dr, nc = c + dc;
                if (this.model.isPosValid(nr, nc) && this.nodesGrid[nr][nc] && list.indexOf(this.nodesGrid[nr][nc]) === -1) {
                    candidates.push(this.nodesGrid[nr][nc]);
                }
            }
        }
        for (let i = 0; i < count && candidates.length > 0; i++) {
            let rndIdx = Math.floor(Math.random() * candidates.length);
            list.push(candidates.splice(rndIdx, 1)[0]);
        }
    }

    // Расчет гравитации и падения кубиков вниз
    applyGravity() {
        for (let c = 0; c < this.cols; c++) {
            let emptyCount = 0;
            for (let r = 0; r < this.rows; r++) {
                if (this.nodesGrid[r][c] === null) {
                    emptyCount++;
                } else if (emptyCount > 0) {
                    let tile = this.nodesGrid[r][c];
                    let newR = r - emptyCount;

                    // Синхронизируем и модель, и визуал
                    this.nodesGrid[newR][c] = tile;
                    this.model.gridData[newR][c] = this.model.gridData[r][c];
                    this.nodesGrid[r][c] = null;
                    this.model.gridData[r][c] = -1;

                    // Фикс координат: используем spacingY
                    let newY = (newR - (this.rows - 1) / 2) * this.spacingY;
                    cc.tween(tile).to(GAME_CONFIG.FALL_DURATION, { y: newY }, { easing: 'bounceOut' }).start();
                    
                    tile.off(cc.Node.EventType.TOUCH_END);
                    tile.on(cc.Node.EventType.TOUCH_END, () => this.onTileClick(newR, c));
                }
            }
            this.fillEmptyTop(c, emptyCount);
        }
        this.scheduleOnce(() => {
            this.checkGameState();
            if (this.hintService) this.hintService.resetTimer();
        }, GAME_CONFIG.CHECK_STATE_DELAY);
    }

    // Заполнение пустых мест сверху новыми кубиками
    fillEmptyTop(c: number, count: number) {
        for (let i = 0; i < count; i++) {
            let r = this.rows - count + i;
            let newTile = cc.instantiate(this.tilePrefab);
            newTile.parent = this.fieldBg;
            newTile.setContentSize(100, 112); // Размер из Figma

            let colorIdx = this.blockIndices[Math.floor(Math.random() * this.blockIndices.length)];
            newTile["colorID"] = colorIdx;
            let sprite = newTile.getComponent(cc.Sprite);
            sprite.spriteFrame = this.tileTextures[colorIdx];
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;

            // Фикс координат: используем spacingX и spacingY
            let x = (c - (this.cols - 1) / 2) * this.spacingX;
            let startY = ((this.rows + i) - (this.rows - 1) / 2) * this.spacingY;
            let targetY = (r - (this.rows - 1) / 2) * this.spacingY;

            newTile.setPosition(x, startY);
            cc.tween(newTile).to(GAME_CONFIG.FALL_DURATION, { y: targetY }, { easing: 'bounceOut' }).start();

            newTile.on(cc.Node.EventType.TOUCH_END, () => this.onTileClick(r, c));
            this.model.gridData[r][c] = colorIdx; // Пишем в модель
            this.nodesGrid[r][c] = newTile;        // Пишем в визуал
        }
    }
}