import GridModel from "./GridModel";
import BoosterService, { IPos } from "../Services/BoosterService";
import HintService from "../Services/HintService";
import BonusService from "../Services/BonusService";
import AudioManager, { SoundType } from "../Services/AudioManager";
import UIManager from "../UI/UIManager";
import { GAME_CONFIG } from "../Data/GameConfig";
import GlobalData from "../Data/GlobalData"; // Импортируем мост
import LevelManager from "./LevelManager";
import FieldManager from "./FieldManager";
import { LEVEL_DATA } from "../Data/LevelConfig"

/**
 * GameController — главный дирижер всего игрового процесса.
 * * ЧТО ЭТО ДЕЛАЕТ:
 * 1. Оркестрация: Связывает модель данных, визуальное поле, бустеры и UI в единую систему.
 * 2. Интерактив: Обрабатывает каждый тап игрока, переключая режимы (обычный ход, телепорт, удаление цвета).
 * 3. Жизненный цикл: Отвечает за старт уровня, проверку победы/поражения и запуск бонусной фазы.
 * 4. Гравитация и перемешивание: Следит за тем, чтобы на поле всегда была движуха и были возможные ходы.
 */

const {ccclass, property} = cc._decorator;

// Состояния меню
enum MenuState {
    PAUSE,
    WIN,
    LOSE
}

@ccclass
export default class GameController extends cc.Component {
    @property(cc.Node) menuButton: cc.Node = null;
    @property(cc.Prefab) tilePrefab: cc.Prefab = null; 
    @property(cc.Node) fieldBg: cc.Node = null; 
    @property([cc.SpriteFrame]) tileTextures: cc.SpriteFrame[] = []; 

    private model: GridModel = null;
    private hintService: HintService = null;
    private bonusService: BonusService = null;


    // НАСТРОЙКИ БАЛАНСА
    private level: LevelManager = null;
    private field: FieldManager = null;
    @property(UIManager) private ui: UIManager = null;


    private isTeleportActive: boolean = false; 
    private firstSelectedTile: { r: number, c: number, node: cc.Node } = null;
    private autoShuffleCount: number = 0;

    // Индексы из твоего массива
    private blockIndices: number[] = [4, 7, 8, 10, 12];
    private rocketIndices: number[] = [9, 11]; // Ракеты
    private bombIdx: number = 5;
    private maxBombIdx: number = 6;
    private colorRemoverIdx: number = 13;
    private isColorRemoverActive: boolean = false;
    private activeRemoverPos: {r: number, c: number} = null;

    private isEndingStarted: boolean = false;

    start() {
        this.level = new LevelManager();
        this.field = new FieldManager(this);
        this.setupLevel();
        this.isEndingStarted = false;
        this.model = new GridModel(this.field.rows, this.field.cols);
        this.bonusService = new BonusService(this, this.model);
        this.hintService = new HintService(this, this.model, this.blockIndices);

        if (this.ui) {
            if (this.ui.gameplayUI) this.ui.gameplayUI.active = true;
            if (this.ui.menuUI) this.ui.menuUI.active = false;
        }

        this.updateUI();
        this.generateField();
        this.setupEventListeners(); 
        this.hintService.resetTimer();
        this.showPreGameMenu();
    }

    /**
     * Возвращает минимальное количество кубиков для матча на текущем уровне.
     */
    private getMinMatchSize(): number {
        const config = LEVEL_DATA[GlobalData.selectedLevel];
        // Если в конфиге уровня есть minMatch — берем его, иначе берем стандарт из GAME_CONFIG
        return (config && config.minMatch) ? config.minMatch : GAME_CONFIG.MIN_MATCH_SIZE;
    }
    private showPreGameMenu() {
        if (this.ui) {
            // 1. Прячем геймплей, показываем меню
            this.ui.gameplayUI.active = false;
            this.ui.menuUI.active = true;

            // 2. Настраиваем кнопки (только Resume и Exit активны)
            if (this.ui.btnResume) this.ui.btnResume.active = true;
            if (this.ui.btnRestart) this.ui.btnRestart.active = false;

            // 3. Рисуем цели в меню
            this.ui.setupTargetMenu(this.getActualTargetsList(), this.tileTextures);
            
            // 4. Паузим игру, пока игрок читает цели
            cc.director.pause();
        }
    }

    showMenu(state: MenuState) {
        if (this.ui) {
            this.ui.showMenu(
                state, 
                this.level.currentScore, 
                this.level.targetScore,
                this.getActualTargetsList(), // Наш массив {id, count}
                this.tileTextures            // Наши спрайты кубиков
            );
        }
    }
    
    // Настройка характеристик уровня
    private setupLevel() {
        const levelData = LEVEL_DATA[GlobalData.selectedLevel] || LEVEL_DATA[1];
        console.log("Доступно бустеров: ", levelData.activeBoosters)
        console.log("ЗАГРУЗКА ДАННЫХ ДЛЯ УРОВНЯ №", GlobalData.selectedLevel);
        if (this.ui) {
            this.ui.setupBoosterPanel(levelData.activeBoosters);
        }
        this.updateUI();
    }

    /**
     * Превращает Map из LevelManager в массив для отправки в UI
     */
    private getActualTargetsList(): {id: number, count: number}[] {
        let list = [];
        // Проходим по всем целям, которые записаны в менеджере уровня
        this.level.targetsProgress.forEach((count, id) => {
            list.push({ id: id, count: count });
        });
        return list;
    }

    setupEventListeners() {
        const ui = UIManager.instance;
        if (!ui) return;

        // Кнопка открытия меню (она осталась в GameController как триггер)
        if (this.menuButton) {
            this.menuButton.on(cc.Node.EventType.TOUCH_END, () => {
                ui.playClickAnimation(this.menuButton, () => {
                    this.showMenu(MenuState.PAUSE);
                });
            });
        } else {
            cc.error("Забыл перетащить кнопку menuButton в инспектор GameController!");
        }

        // Кнопка "Продолжить" (только снимает паузу)
        if (this.ui.btnResume) {
            this.ui.btnResume.on(cc.Node.EventType.TOUCH_END, () => {
                cc.director.resume();
                ui.playClickAnimation(this.ui.btnResume, () => {
                    if (this.level.isWin()) {
                        // Если уровней еще много (меньше 10), прибавляем +1 и перезагружаем сцену
                        if (GlobalData.selectedLevel < 10) {
                            GlobalData.selectedLevel++;
                            this.restartGame(); // Сцена перезапустится и сама покажет пре-меню нового уровня
                        } else {
                            // Если прошли последний уровень, возвращаемся на карту
                            cc.director.loadScene("MapScene");
                        }
                    }else {
                        if (this.ui.menuUI) {
                            this.ui.menuUI.active = false;
                            this.ui.gameplayUI.active = true;
                        }
                    }
                });
            });
        }

        // Кнопка "Заново"
        if (this.ui.btnRestart) {
            this.ui.btnRestart.on(cc.Node.EventType.TOUCH_END, () => {
                cc.director.resume();
                ui.playClickAnimation(this.ui.btnRestart, () => {
                    this.restartGame();
                });
            });
        }

        // Кнопка "На карту"
        if (this.ui.btnExit) {
            this.ui.btnExit.on(cc.Node.EventType.TOUCH_END, () => {
                cc.director.resume();
                ui.playClickAnimation(this.ui.btnExit, () => {
                    cc.director.loadScene("MapScene"); 
                });
            });
        }

        // >>> БУСТЕР ТЕЛЕПОРТ <<<
        if (this.ui.btnTeleport) {
            this.ui.btnTeleport.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
                if (this.level.teleports <= 0) return;

                if (this.isTeleportActive) {
                    // ПОВТОРНОЕ НАЖАТИЕ: ОТМЕНА
                    this.isTeleportActive = false;
                    ui.setBoosterVisualActive(this.ui.btnTeleport, false);
                    
                    if (this.firstSelectedTile) {
                        cc.tween(this.firstSelectedTile.node).to(0.1, { scale: 1 }).start();
                        this.firstSelectedTile = null;
                    }
                    cc.log("ТЕЛЕПОРТ: Режим отменен игроком");
                } else {
                    // ПЕРВОЕ НАЖАТИЕ: ВКЛЮЧЕНИЕ
                    this.isTeleportActive = true;
                    ui.setBoosterVisualActive(this.ui.btnTeleport, true);
                    cc.log("ТЕЛЕПОРТ: Выберите первый тайл");
                }
                event.stopPropagation();
            });
        }

        // >>> ОСТАЛЬНЫЕ БУСТЕРЫ (вспышка) <<<
        const boosters = [
            { btn: this.ui.btnRandomBomb, action: () => this.useRandomBombBooster(), getCount: () => this.level.bombs },
            { btn: this.ui.btnColorRemover, action: () => this.useColorRemoverBooster(), getCount: () => this.level.removers },
            { btn: this.ui.btnRandomSpawner, action: () => this.useRandomSpawnerBooster(), getCount: () => this.level.spawners }
        ];

        boosters.forEach(b => {
            if (b.btn) {
                b.btn.on(cc.Node.EventType.TOUCH_END, (event: cc.Event.EventTouch) => {
                    if (b.getCount() > 0) {
                        // Используем «вспышку»: покраснела-уменьшилась и тут же вернулась
                        ui.playBoosterClickAnimation(b.btn, () => b.action());
                    } else {
                        cc.log("Бустер закончился!");
                    }
                    event.stopPropagation();
                });
            }
        });
    }

    private useRandomSpawnerBooster() {
        if (this.level.spawners <= 0) return;
        // 1. Собираем список всех координат, где сейчас лежат ОБЫЧНЫЕ кубики
        // Чтобы не заспавнить бустер поверх другого бустера или пустоты
        let validPositions: IPos[] = [];
        for (let r = 0; r < this.field.rows; r++) {
            for (let c = 0; c < this.field.cols; c++) {
                let id = this.model.gridData[r][c];
                if (this.blockIndices.indexOf(id) !== -1) {
                    validPositions.push({ r, c });
                }
            }
        }

        if (validPositions.length === 0) return;

        // 2. Выбираем случайную позицию из найденных
        let randomPos = validPositions[Math.floor(Math.random() * validPositions.length)];
        
        // 3. Выбираем случайный тип бустера
        let randomBoosterId = BoosterService.getRandomBoosterId();

        // 4. Заменяем кубик на бустер
        if (this.field.nodesGrid[randomPos.r][randomPos.c]) {
            this.field.nodesGrid[randomPos.r][randomPos.c].destroy(); // Удаляем старый кубик
            
            // Используем наш универсальный метод спавна (он сам поставит scale 0.6 если выпадет Звезда)
            this.spawnBooster(randomPos.r, randomPos.c, randomBoosterId);
            
            // 5. Тратим заряд и обновляем UI
            this.level.spawners--;
            this.updateUI();

            cc.log(`МАГИЯ: В ячейке [${randomPos.r},${randomPos.c}] появился бустер ID ${randomBoosterId}`);
        }
    }

    /**
     * Логика появления бустера на поле при клике на кнопку в UI
     */
    private useColorRemoverBooster() {
        if (this.level.removers <= 0) return;
        // 1. Выбираем случайную клетку на поле
        let r = Math.floor(Math.random() * this.field.rows);
        let c = Math.floor(Math.random() * this.field.cols);

        // 2. Если там есть кубик — заменяем его на бустер-звезду
        if (this.field.nodesGrid[r][c]) {
            this.field.nodesGrid[r][c].destroy(); // Удаляем старый кубик
            this.spawnBooster(r, c, this.colorRemoverIdx); // Спавним ID 13
            
            // 3. Тратим заряд из инвентаря
            this.level.removers--;
            this.updateUI();
            
            cc.log("БУСТЕР: Звезда появилась на поле! Нажмите на неё, а затем на соседний цвет.");
        }
    }

    // Логика обмена тайлов местами
    handleTeleportSwap(r: number, c: number) {
        let clickedNode = this.field.nodesGrid[r][c];
        let clickedId = this.model.gridData[r][c]

        // 1. ВЫБОР ПЕРВОГО ТАЙЛА
        if (!this.firstSelectedTile) {
            if (this.isColorRemoverActive) this.cancelColorRemoverMode();
            this.firstSelectedTile = { r, c, node: clickedNode };
            
            // КУБИК УВЕЛИЧИВАЕТСЯ И ОСТАЕТСЯ БОЛЬШИМ 
            let targetScale = (clickedId === this.colorRemoverIdx) ? 0.7 : 1.2;
            cc.tween(clickedNode).to(0.15, { scale: targetScale }).start();
            
            cc.log("Первый кубик зафиксирован. Ждем второй.");
            return;
        }

        // 2. ВЫБОР ВТОРОГО ТАЙЛА И ОБМЕН
        let tile1 = this.firstSelectedTile;
        
        // Если кликнули на тот же самый кубик — отменяем всё
        if (tile1.r === r && tile1.c === c) {
            let resetScale = (clickedId === this.colorRemoverIdx) ? 0.6 : 1.0;
            cc.tween(tile1.node).to(0.1, { scale: resetScale }).start();
            this.ui.btnTeleport.color = cc.Color.WHITE;
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

        let scaleForTile1 = (this.model.gridData[tile1.r][tile1.c] === this.colorRemoverIdx) ? 0.6 : 1.0;
        let scaleForClicked = (this.model.gridData[r][c] === this.colorRemoverIdx) ? 0.6 : 1.0;

        // Анимируем перемещение и возвращаем масштаб первого кубика в норму
        cc.tween(tile1.node).to(0.3, { x: pos2.x, y: pos2.y, scale: scaleForClicked }).start();
        cc.tween(clickedNode).to(0.3, { x: pos1.x, y: pos1.y, scale: scaleForTile1}).start();

        // Обмен ссылками в массиве узлов (View)
        this.field.nodesGrid[tile1.r][tile1.c] = clickedNode;
        this.field.nodesGrid[r][c] = tile1.node;

        // ВАЖНО: Обновляем обработчики клика, так как координаты кубиков изменились
        tile1.node.off(cc.Node.EventType.TOUCH_END);
        clickedNode.off(cc.Node.EventType.TOUCH_END);
        
        // Привязываем новые координаты к старым нодам
        tile1.node.on(cc.Node.EventType.TOUCH_END, () => this.onTileClick(r, c));
        clickedNode.on(cc.Node.EventType.TOUCH_END, () => this.onTileClick(tile1.r, tile1.c));

        // Завершаем работу бустера
        this.level.teleports--;
        this.isTeleportActive = false;
        if (UIManager.instance) {
            UIManager.instance.setBoosterVisualActive(this.ui.btnTeleport, false);
        }
        this.firstSelectedTile = null;
        this.updateUI();
        
        // Проверяем, не создали ли мы комбинацию этим обменом
        this.scheduleOnce(() => this.checkGameState(), 0.4);
    }

    generateField() {
        this.model.initGrid();
        this.field.nodesGrid = []; // Очищаем массив в менеджере
        this.fieldBg.removeAllChildren();
        
        for (let r = 0; r < this.field.rows; r++) {
            // КРИТИЧЕСКИ ВАЖНО: создаем пустой ряд
            this.field.nodesGrid[r] = []; 
            
            for (let c = 0; c < this.field.cols; c++) {
                let colorIdx = this.model.getSmartColor(r, c, this.blockIndices);
                this.model.gridData[r][c] = colorIdx;
                
                // Просим менеджера нарисовать
                this.spawnTile(r, c); 
            }
        }
    }

    /**
     * Включает режим ожидания выбора цвета. 
     * Вызывается, когда игрок нажал на радужный бустер на поле.
     */
    private activateColorRemoverMode(r: number, c: number) {
        this.isColorRemoverActive = true;
        this.activeRemoverPos = { r, c };

        // Визуальный эффект: бустер "подпрыгивает", показывая, что он выбран
        let node = this.field.nodesGrid[r][c];
        if (node) {
            cc.tween(node)
                .to(0.15, { scale: 0.7 })
                .start();
        }
        cc.log("COLOR REMOVER: Теперь нажми на соседний цветной кубик");
    }

    private cancelColorRemoverMode() {
        if (this.activeRemoverPos) {
            let node = this.field.nodesGrid[this.activeRemoverPos.r][this.activeRemoverPos.c];
            if (node) cc.tween(node).to(0.1, { scale: 0.6 }).start();
        }
        this.isColorRemoverActive = false;
        this.activeRemoverPos = null;
        cc.log("COLOR REMOVER: Отменено");
    }

    /**
     * Выполняет логику удаления цвета. 
     * Вызывается, когда игрок нажал на кубик после активации бустера.
     */
    private executeColorRemoval(clickedR: number, clickedC: number) {
        const boosterPos = this.activeRemoverPos;
        const clickedId = this.model.gridData[clickedR][clickedC];

        // 1. ПРОВЕРКА СОСЕДСТВА (без неё комбо не сработает)
        const dist = Math.abs(boosterPos.r - clickedR) + Math.abs(boosterPos.c - clickedC);
        if (dist !== 1) {
            cc.log("Комбо или удаление цвета возможно только с СОСЕДНИМ объектом!");
            return; 
        }

        let tilesToRemove: IPos[] = [];

        // 2. ЛОГИКА КОМБО 
        if (BoosterService.isBooster(clickedId)) {
            cc.log("АКТИВАЦИЯ КОМБО ЧЕРЕЗ СЕРВИС");
            
            // Вызываем новый эксклюзивный метод из сервиса
            tilesToRemove = BoosterService.getStarComboArea(
                clickedId, 
                clickedR, clickedC, 
                this.field.rows, this.field.cols
            );

            if (clickedId === this.colorRemoverIdx) {
                this.field.shake(this.ui.gameplayUI, 70);
                AudioManager.instance.playSFX(SoundType.BOMB_BIG);
            } else {
                this.field.shake(this.ui.gameplayUI, 40);
                AudioManager.instance.playSFX(SoundType.BOMB_BIG);
            }
        } 

        // 3. ОБЫЧНАЯ ЛОГИКА УДАЛЕНИЯ ЦВЕТА (если нажали на кубик)
        else if (this.blockIndices.indexOf(clickedId) !== -1) {
            tilesToRemove = BoosterService.getAllTilesOfColor(clickedId, this.model.gridData, this.field.rows, this.field.cols);
            
            let sfx = (tilesToRemove.length >= 5) ? SoundType.BIG : SoundType.SMALL;
            AudioManager.instance.playSFX(sfx);
        } 
        else {
            cc.log("Режим Звезды: Выбери цветной кубик или другой бустер рядом!");
            return;
        }

        // Добавляем саму Звезду в список на удаление
        tilesToRemove.push(boosterPos);

        // Финалим действие
        this.field.destroyTiles(tilesToRemove);
        tilesToRemove.forEach(p => {
            // Получаем ID перед удалением (цвет или бустер при комбо)
            let id = this.model.gridData[p.r][p.c];
            this.level.collectItem(id); //
            
            this.model.gridData[p.r][p.c] = -1;
        });

        this.isColorRemoverActive = false;
        this.activeRemoverPos = null;
        this.level.addScore(tilesToRemove.length * GAME_CONFIG.POINTS_PER_NORMAL_TILE);
        this.updateUI();

        this.scheduleOnce(() => {
            this.field.applyGravity(() => this.checkGameState());
        }, GAME_CONFIG.GRAVITY_DELAY);
    }

    // Обработка нажатия на плитку
    onTileClick(r: number, c: number) {
        if (this.isEndingStarted) return;
        if (this.hintService) this.hintService.resetTimer();
        if (this.isTeleportActive) {
            this.handleTeleportSwap(r, c);
            return; 
        }

        let id = this.model.gridData[r][c];

        if (id === this.colorRemoverIdx) {
            // Если уже есть одна активная звезда
            if (this.isColorRemoverActive && this.activeRemoverPos) {
                
                // Проверяем, не нажали ли мы на ту же самую звезду
                if (this.activeRemoverPos.r === r && this.activeRemoverPos.c === c) {
                    this.cancelColorRemoverMode();
                    return;
                }

                // Считаем дистанцию до соседней звезды
                const dist = Math.abs(this.activeRemoverPos.r - r) + Math.abs(this.activeRemoverPos.c - c);
                
                if (dist === 1) {
                    // СОСЕДИ! Запускаем Мега-комбо
                    this.executeColorRemoval(r, c);
                } else {
                    // Не соседи — отменяем старую, активируем новую
                    this.cancelColorRemoverMode();
                    this.activateColorRemoverMode(r, c);
                }
            } else {
                // Первая активация звезды (ошибки больше не будет, так как нет расчета dist)
                this.activateColorRemoverMode(r, c);
            }
            return;
        }

        if (this.isColorRemoverActive) {
            this.executeColorRemoval(r, c);
            return;
        }

        let matches = this.model.findMatches(r, c, id);

        // Если нажали на бустер активируем спец-логику
        if (this.rocketIndices.indexOf(id) !== -1 || id === this.bombIdx || id === this.maxBombIdx) {
            this.activatePowerUp(r, c, id);
            return;
        }

        const currentMinMatch = this.getMinMatchSize();

        // визуальный эффект: Увеличиваем всю группу совпавших тайлов
        matches.forEach(pos => {
            let node = this.field.nodesGrid[pos.r][pos.c];
            if (node) {
                // Быстрое увеличение и возврат, создающее эффект «пуп!»
                cc.tween(node)
                    .to(0.05, { scale: 1.1 })
                    .to(0.05, { scale: 1.0 })
                    .start();
            }
        });

        if (matches.length < currentMinMatch) return;
        this.scheduleOnce(() => {
            AudioManager.instance.playSFX(matches.length > 5 ? SoundType.BIG : SoundType.SMALL);
   

            this.level.useMove(); 
            this.level.addScore(matches.length * GAME_CONFIG.POINTS_PER_NORMAL_TILE);

            this.updateUI();

            this.field.destroyTiles(matches); // Поле само удаляет ноды
            matches.forEach(pos => {
                // Сначала узнаем ID кубика в этой позиции
                let id = this.model.gridData[pos.r][pos.c];
                // Отправляем его в LevelManager для учета в целях
                this.level.collectItem(id);
                // После этого обнуляем данные в модели
                this.model.gridData[pos.r][pos.c] = -1;
            });

            // Проверка на создание нового бустера после хода
            let boosterToSpawn = -1;

            if (matches.length >= GAME_CONFIG.THRESHOLDS.COLOR_REMOVER.min) {
                boosterToSpawn = this.colorRemoverIdx; // Звезда
            } else if (matches.length >= GAME_CONFIG.THRESHOLDS.BOMB_MAX.min) {
                boosterToSpawn = this.maxBombIdx;      // Большая бомба
            } else if (matches.length >= GAME_CONFIG.THRESHOLDS.BOMB_SMALL.min) {
                boosterToSpawn = this.bombIdx;         // Малая бомба
            } else if (matches.length >= GAME_CONFIG.THRESHOLDS.ROCKET.min) {
                boosterToSpawn = this.rocketIndices[Math.floor(Math.random() * 2)]; // Ракета
            }

            // Если условия выполнены, спавним бустер в точку клика [r, c]
            if (boosterToSpawn !== -1) {
                this.spawnBooster(r, c, boosterToSpawn);
            }

            this.updateUI();
            this.scheduleOnce(() => {
                this.field.applyGravity(() => {
                    // ВАЖНО: Проверку игры делаем только когда кубики допадали!
                    this.checkGameState();
                });
            }, GAME_CONFIG.GRAVITY_DELAY);
        }, 0.1);
    }  
    
    // Проверка условий победы или поражения
    checkGameState() {
        if (this.isEndingStarted) return;

        if (this.level.isWin()) {
            console.log("Победа! Запуск бонуса...");
            this.isEndingStarted = true;
            
            // Запускаем бонус и передаем функцию, которая выполнится В КОНЦЕ
            this.bonusService.startWinBonus(() => {
                const finalScore = this.level.currentScore;
                const targetScore = this.level.targetScore;

                // Теперь считаем звезды на основе финального счета
                const stars = GlobalData.calculateStars(finalScore, targetScore);
                GlobalData.saveLevelProgress(GlobalData.selectedLevel, stars);

                console.log(`Финальный расчет: ${finalScore} очков, звезд: ${stars}.`);

                // Только теперь показываем финальное меню
                this.showEndGame(true); 
            });
            return;
        }

        const currentMinMatch = this.getMinMatchSize();
        const hasMovesOnBoard = this.model.hasPossibleMatches(this.blockIndices, currentMinMatch);
        if (!hasMovesOnBoard) {
            // Проверяем лимит авто-перемешиваний
            if (this.autoShuffleCount < GAME_CONFIG.AUTO_SHUFFLE_LIMIT) {
                this.autoShuffleCount++;
                this.executeShuffleLogic();
                
                // Ждем завершения анимации перемешивания (3 сек) и проверяем снова
                this.scheduleOnce(() => this.checkGameState(), 3.0); 
                return;
            } else {
                this.showMenu(MenuState.LOSE);
                return;
            }
        }

        if (this.level.isGameOver()) {
            this.isEndingStarted = true;
            this.fieldBg.resumeSystemEvents(true);
            this.showMenu(MenuState.LOSE);
        }
    }

    // Логика перемешивания 
    executeShuffleLogic() {
        AudioManager.instance.playSFX(SoundType.SHUFFLE);

        // 1. Просим FieldManager запустить анимацию
        this.field.animateShuffle(() => {
            
            // 2. Внутри анимации (когда кубики невидимы) перемешиваем данные в модели
            this.model.shuffleGrid();
            
            // 3. Синхронизируем спрайты визуальных нод с новыми данными из модели
            for (let r = 0; r < this.field.rows; r++) {
                for (let c = 0; c < this.field.cols; c++) {
                    let node = this.field.nodesGrid[r][c];
                    if (node) {
                        let newID = this.model.gridData[r][c];
                        node.getComponent(cc.Sprite).spriteFrame = this.tileTextures[newID];
                        
                        // Опционально: если это Звезда, возвращаем ей размер снаряда 0.6
                        if (newID === this.colorRemoverIdx) node.scale = 0.6;
                        else node.scale = 1.0;
                    }
                }
            }
        });
    }

    // Метод для показа финала
    showEndGame(isWin: boolean) {
        if (this.ui.menuUI && this.ui.menuUI.active) return;
        if (AudioManager.instance) {
            AudioManager.instance.playSFX(isWin ? SoundType.WIN : SoundType.LOSE);
        }

        this.showMenu(isWin ? MenuState.WIN : MenuState.LOSE);
    }

    // Метод для кнопки "ДА" (сброс игры)
    restartGame() {
        // Перезагружаем текущую сцену целиком
        cc.director.loadScene(cc.director.getScene().name);
    }

    // Метод для обновления текста на экране
    updateUI() {
        // Передаем данные в UI менеджер. Теперь GameController не заботится о цвете кнопок.
        if (UIManager.instance) {
            UIManager.instance.updateGameplayUI(
                this.level.currentScore,
                this.level.targetScore,
                this.level.currentMoves,
                this.level.teleports,
                this.level.bombs,
                this.level.removers,
                this.level.spawners
            );
            // Обновляем цели в верхней панели
            UIManager.instance.updateGameplayTargets(
                this.getActualTargetsList(), 
                this.tileTextures
            );
        }
    }

    // бустер бомбы
    useRandomBombBooster() {
        if (this.level.bombs <= 0) return;
        // если был включен телепорт выключаем его при выборе бомбы
        if (this.isTeleportActive) {
            this.isTeleportActive = false;
            if (this.ui.btnTeleport) this.ui.btnTeleport.color = cc.Color.WHITE;
            if (this.firstSelectedTile) {
                cc.tween(this.firstSelectedTile.node).to(0.1, { scale: 1 }).start();
                this.firstSelectedTile = null;
            }
        }
        let r = Math.floor(Math.random() * this.field.rows);
        let c = Math.floor(Math.random() * this.field.cols);
        if (this.field.nodesGrid[r][c]) {
            this.field.nodesGrid[r][c].destroy();
            this.spawnBooster(r, c, this.bombIdx);
            this.level.bombs--;
            this.updateUI();
        }
    }

    // Метод для обычных кубиков (используется при генерации и падении)
    spawnTile(r: number, c: number) {
        let colorIdx = this.model.getSmartColor(r, c, this.blockIndices); // 1. Решаем, какой цвет
        this.model.gridData[r][c] = colorIdx;    // 2. Пишем в Модель (данные)
        this.field.createNodeAt(r, c, colorIdx); // 3. Рисуем через Поле (визуал)
    }

    // Метод для бустеров (награда за комбинацию)
    spawnBooster(r: number, c: number, id: number) {
        this.model.gridData[r][c] = id;         // 1. Пишем ID бустера в данные
        this.field.createNodeAt(r, c, id);      // 2. Рисуем через Поле

        let node = this.field.nodesGrid[r][c];
        if (node && id === this.colorRemoverIdx) {
            // Уменьшаем до 0.6, чтобы она выглядела меньше обычного кубика
            node.scale = 0.6; 
        }
        
        // звук появления бустера
        AudioManager.instance.playSFX(SoundType.SMALL);
    }

    // Активация бустера с поддержкой цепных реакций
    activatePowerUp(r: number, c: number, id: number) {
        // 1. ПОЛУЧАЕМ РАСЧЕТЫ (Логика ушла в сервис)
        const result = BoosterService.calculateChainExplosion(
            r, c, id, 
            this.model.gridData, 
            this.field.rows, 
            this.field.cols
        );

        // 2. ИСПОЛНЯЕМ ВИЗУАЛ (Звуки, тряска)
        result.activatedBoosters.forEach(b => {
            // Тряска
            if (b.id === this.bombIdx) this.field.shake(this.fieldBg, 10);
            else if (b.id === this.maxBombIdx) this.field.shake(this.ui.gameplayUI, 30);

            // Звук
            let sfx = SoundType.ROCKET;
            if (b.id === this.bombIdx) sfx = SoundType.BOMB_SMALL;
            if (b.id === this.maxBombIdx) sfx = SoundType.BOMB_BIG;
            AudioManager.instance.playSFX(sfx);
        });

        // 3. УДАЛЯЕМ ТАЙЛЫ
        if (result.totalArea.length > 0) {
            this.field.destroyTiles(result.totalArea);
            result.totalArea.forEach(pos => {
                let id = this.model.gridData[pos.r][pos.c];
                this.level.collectItem(id);
                this.level.addScore(GAME_CONFIG.BOOSTER_EXPLOSION_DIVIDER);
                this.model.gridData[pos.r][pos.c] = -1;
            });
        }
        this.updateUI();
        this.field.applyGravity(() => {
            this.checkGameState();
        });
    }
}