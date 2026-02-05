import AudioManager, { SoundType } from "../Services/AudioManager";
import GlobalData from "../Data/GlobalData";
import { GAME_CONFIG } from "../Data/GameConfig";
import {LEVEL_DATA, ITarget } from "../Data/LevelConfig";

/**
 * UIManager — главный мозг всего интерфейса в игре.
 * * ЧТО ЭТО ДЕЛАЕТ:
 * 1. Gameplay: В реальном времени обновляет счетчики очков, ходов и целей.
 * 2. Бустеры: Настраивает панель бустеров, их количество и визуальное состояние (активен/заблокирован).
 * 3. Меню: Управляет всеми экранами (Пауза, Победа, Поражение) и пре-игровым меню с целями.
 * 4. Обучение: Динамически генерирует список правил и механик под конкретный уровень.
 */

const {ccclass, property} = cc._decorator;

export enum MenuState {
    PAUSE,
    WIN,
    LOSE
}

@ccclass
export default class UIManager extends cc.Component {
    public static instance: UIManager = null;

    // >>> ЭЛЕМЕНТЫ ИНТЕРФЕЙСА <<<
    @property(cc.Node) gameplayUI: cc.Node = null;
    @property(cc.Label) scoreLabel: cc.Label = null;
    @property(cc.Label) movesLabel: cc.Label = null;
    
    // >>> ССЫЛКИ НА БУСТЕРЫ (ДЛЯ ОБРАБОТКИ КЛИКОВ) <<<
    @property(cc.Node) btnTeleport: cc.Node = null;
    @property(cc.Node) btnRandomBomb: cc.Node = null;
    @property(cc.Node) btnColorRemover: cc.Node = null; // Бустер удаления цвета
    @property(cc.Node) btnRandomSpawner: cc.Node = null; // Бустер случайного спавна
    
    // >>> ТЕКСТОВЫЕ СЧЕТЧИКИ БУСТЕРОВ <<<
    @property(cc.Label) teleportLabel: cc.Label = null;
    @property(cc.Label) boosterBombLabel: cc.Label = null;
    @property(cc.Label) colorRemoverLabel: cc.Label = null;
    @property(cc.Label) randomSpawnerLabel: cc.Label = null;

    // >>> ПАНЕЛЬ И СЛОТЫ <<<
    @property(cc.Node) boosterPanel: cc.Node = null; // Нода с компонентом cc.Layout
    @property([cc.Node]) boosterSlots: cc.Node[] = []; // Твои 4 слота

    // >>> UI ЭЛЕМЕНТЫ МЕНЮ <<<
    @property(cc.Node) menuUI: cc.Node = null;
    @property(cc.Label) menuTitle: cc.Label = null;
    @property(cc.Label) menuScoreLabel: cc.Label = null;
    @property(cc.Node) btnResume: cc.Node = null;
    @property(cc.Node) btnRestart: cc.Node = null;
    @property(cc.Node) btnExit: cc.Node = null;

    // >>> ПРЕМЕНЮ <<<
    @property(cc.Node) targetContainer: cc.Node = null;
    @property(cc.Prefab) targetItemPrefab: cc.Prefab = null;
    @property(cc.Label) scoreHeaderText: cc.Label = null;

    // >>> ЦЕЛЬ ВО ВРЕМЯ ИГРЫ <<<
    @property(cc.Node) gameplayTargetContainer: cc.Node = null; 
    @property(cc.Prefab) gameplayTargetItemPrefab: cc.Prefab = null;

    // >>> ПРАВИЛА И МЕХАНИКИ УРОВНЯ <<<
    @property(cc.Prefab) rulePrefab: cc.Prefab = null; 
    @property(cc.Node) rulesContainer: cc.Node = null;
    @property([cc.SpriteFrame]) tileTextures: cc.SpriteFrame[] = [];


    private currentLevelActiveCount: number = 0;
    private readonly BOOSTER_ACTIVE_COLOR = new cc.Color(255, 150, 150);

    onLoad() {
        UIManager.instance = this;
    }

    /**
     * Генерирует список правил в зависимости от номера уровня.
     * Реализует логику постепенного усложнения и обучения.
     */
    public setupLevelRules() {
        if (!this.rulesContainer || !this.rulePrefab) return;

        const levelIdx = GlobalData.selectedLevel;
        const config = LEVEL_DATA[levelIdx] || LEVEL_DATA[1];
        
        // Очищаем контейнер перед заполнением
        this.rulesContainer.removeAllChildren();

        // ПРАВИЛО №1 (Всегда): От какого размера группы лопаются кубики
        const minMatch = config.minMatch || 2;
        // Помечаем вопросом, если правило отличается от стандартного (например, > 2)
        this.addRuleRow(`Кубики лопаются от размера группы: ${minMatch} кубика.`, true, this.tileTextures[0]);

        // Логика дополнительных правил по уровням
        switch (levelIdx) {
            case 2:
                // Правило про обычную бомбу
                this.addRuleRow(`Бомба: лопнутая группа кубиков от ${GAME_CONFIG.THRESHOLDS.BOMB_SMALL.min} шт. При тапе, взрывается.`, false, this.tileTextures[1]);
                this.addRuleRow(`Ракета: лопнуть группу кубиков от ${GAME_CONFIG.THRESHOLDS.ROCKET.min} шт. При тапе, удаляет ряд.`, false, this.tileTextures[6])
                break;

            case 3:
                // Описание телепорта + большая бомба
                this.addRuleRow("Телепорт: Жми бустер и тапни на 2 объекта в поле для обмена.", false, this.tileTextures[2]);
                this.addRuleRow(`Мега-бомба: лопнутая группа кубиков от ${GAME_CONFIG.THRESHOLDS.BOMB_MAX.min} шт. При тапе, взрывается.`, false, this.tileTextures[3]);
                break;

            case 4:
                // Правило про звезду
                this.addRuleRow(`Звезда: от ${GAME_CONFIG.THRESHOLDS.COLOR_REMOVER.min} шт. Тапните звезду и соседа: удалит цвет или сделает комбо.`, false, this.tileTextures[4]);
                break;

            case 5:
                // Правило про случайный спавн
                this.addRuleRow("Магия: спавн случайного бустера на поле.", false, this.tileTextures[5]);
                break;

            default:
                // Для уровней 6-10 можно выводить краткую сводку самых важных правил
                if (levelIdx > 5) {
                    this.addRuleRow(`Звезда: от ${GAME_CONFIG.THRESHOLDS.COLOR_REMOVER.min} кубиков`, false, this.tileTextures[4]);
                }
                break;
        }

        const allRules = this.rulesContainer.children;
        const targetFontSize = allRules.length >= 3 ? 25 : 35;

        allRules.forEach(ruleNode => {
            let labelNode = ruleNode.getChildByName("Lable Rule");
            if (labelNode) {
                let label = labelNode.getComponent(cc.Label);
                if (label) {
                    label.fontSize = targetFontSize;
                    label.lineHeight = targetFontSize + 5; // Корректируем межстрочный интервал
                }
            }
        });
    }

    /**
     * Создает экземпляр правила и настраивает текст в "Lable Rule"
     */
    private addRuleRow(text: string, isHighlighted: boolean, iconSprite: cc.SpriteFrame) {
        let ruleNode = cc.instantiate(this.rulePrefab);
        ruleNode.parent = this.rulesContainer;

        // Находим текстовый компонент (используем твое имя с опечаткой из редактора)
        if (isHighlighted) {
            let label = ruleNode.getChildByName("Lable Rule");
            if (label) label.color = cc.Color.GREEN;
        }

        // Установка текста
        let labelNode = ruleNode.getChildByName("Lable Rule");
        if (labelNode) {
            let label = labelNode.getComponent(cc.Label);
            if (label) label.string = text;
        }

        // Установка иконки
        let iconNode = ruleNode.getChildByName("Icon Rule");
        if (iconNode && iconSprite) {
            iconNode.getComponent(cc.Sprite).spriteFrame = iconSprite;
        }
    }

    /**
     * Первоначальная настройка панели бустеров при старте уровня.
     * Определяет, сколько кнопок будет на экране и как они выглядят.
     */
    setupBoosterPanel(activeCount: number) {
        this.currentLevelActiveCount = activeCount;
        const layout = this.boosterPanel.getComponent(cc.Layout);
        
        // Показываем активные + 1 превью (максимум 4)
        let totalToShow = Math.min(activeCount + 1, 4);
        
        // Адаптивный Layout: если бустеров 4 — сжимаем их (spacing -50)
        if (totalToShow === 4) {
            layout.spacingX = -50;
        } else {
            layout.spacingX = 0; // Стандартное расстояние для 1-3 бустеров
        }

        for (let i = 0; i < this.boosterSlots.length; i++) {
            let slot = this.boosterSlots[i];
            if (!slot) continue;

            if (i < totalToShow) {
                slot.active = true;
                
                // Настройка ширины и дочерних элементов при 4-х бустерах
                if (totalToShow === 4) {
                    slot.width = 300;
                    let labelBg = slot.getChildByName("Slot booster"); // Уточни имя ноды с числом
                    if (labelBg) labelBg.width = 205;
                }

                // Логика: i < лимита — активен, i == лимиту — превью (прозрачный)
                if (i < activeCount) {
                    this.applySafeVisualState(slot, 255, true, cc.Color.WHITE);
                } else {
                    this.applySafeVisualState(slot, 120, false, cc.Color.GRAY);
                }
            } else {
                // Все остальные — скрываем совсем
                slot.active = false;
            }
        }
        
        // Принудительно обновляем Layout, чтобы изменения применились сразу
        layout.updateLayout();
    }

    /**
     * Обновляет все счетчики и состояние кнопок бустеров на экране
     */
    public updateGameplayUI(score: number, target: number, moves: number, teleports: number, bombs: number, removers: number = 0, spawners: number = 0) {
        // Обновляем текст
        if (this.scoreLabel) this.scoreLabel.string = `${score}/${target}`;
        if (this.movesLabel) this.movesLabel.string = moves.toString();
        if (this.teleportLabel) this.teleportLabel.string = teleports.toString();
        if (this.boosterBombLabel) this.boosterBombLabel.string = bombs.toString();

        // Синхронизируем каждый бустер индивидуально
        // Порядок: 0-Bomb, 1-Teleport, 2-ColorRemover, 3-RandomSpawner
        this.setBoosterVisualState(this.btnRandomBomb, this.boosterBombLabel, bombs, 0);
        this.setBoosterVisualState(this.btnTeleport, this.teleportLabel, teleports, 1);
        this.setBoosterVisualState(this.btnColorRemover, this.colorRemoverLabel, removers, 2);
        this.setBoosterVisualState(this.btnRandomSpawner, this.randomSpawnerLabel, spawners, 3);
    }

    /**
     * Вспомогательный метод управления визуалом конкретной кнопки.
     */
    private setBoosterVisualState(node: cc.Node, label: cc.Label, count: number, index: number) {
        if (!node) return;

        if (index > this.currentLevelActiveCount) {
            node.active = false;
            return;
        }

        // Если бустер за пределами лимита уровня + превью — гасим его
        if (index === this.currentLevelActiveCount) {
            node.active = true;
            if (label) label.string = "-";
            this.applySafeVisualState(node, 150, false, cc.Color.GRAY);
            return;
        }

        // Обработка активного разблокированного бустера
        node.active = true;
        if (label) label.string = count.toString();
        if (count <= 0) {
            this.applySafeVisualState(node, 150, false, cc.Color.GRAY);
        } else {
            this.applySafeVisualState(node, 255, true, cc.Color.WHITE);
        }
    }

    /**
     * Безопасная установка прозрачности, цвета и кликабельности (не падает без Button).
     */
    private applySafeVisualState(node: cc.Node, opacity: number, interactable: boolean, color: cc.Color) {
        node.opacity = opacity;
        node.color = color;
        let btn = node.getComponent(cc.Button);
        if (btn) {
            btn.interactable = interactable;
        } else {
            if (interactable) node.resumeSystemEvents(true);
            else node.pauseSystemEvents(true);
        }
    }

    /**
     * Анимация клика для любой кнопки
     */
    public playClickAnimation(node: cc.Node, callback: Function) {
        if (!node) return;

        AudioManager.instance.playSFX(SoundType.SMALL);

        cc.tween(node)
            .to(0.1, { scale: 0.9 })
            .to(0.1, { scale: 1.0 })
            .call(() => callback())
            .start();
    }

    /**
     * Мгновенная анимация для Бомбы, Спавнера и Ремувера
     */
    public playBoosterClickAnimation(node: cc.Node, callback: Function) {
        if (!node) return;
        AudioManager.instance.playSFX(SoundType.SMALL);

        cc.tween(node)
            .to(0.1, { scale: 0.9, color: this.BOOSTER_ACTIVE_COLOR })
            .to(0.1, { scale: 1.0, color: cc.Color.WHITE })
            .call(() => callback && callback())
            .start();
    }

    /**
     * Фиксация состояния для Телепорта
     */
    public setBoosterVisualActive(node: cc.Node, isActive: boolean) {
        if (!node) return;
        cc.tween(node).stop();
        
        if (isActive) {
            // Уменьшаем и красим в красный
            cc.tween(node).to(0.1, { scale: 0.9, color: this.BOOSTER_ACTIVE_COLOR }).start();
        } else {
            // Возвращаем в норму
            cc.tween(node).to(0.1, { scale: 1.0, color: cc.Color.WHITE }).start();
        }
    }
    /**
     * Универсальный метод отрисовки иконок целей.
     * Передавай сюда актуальный массив {id, count}
     */
    private renderTargetIcons(targets: {id: number, count: number}[], textures: cc.SpriteFrame[]) {
        if (!this.targetContainer || !this.targetItemPrefab) return;
        
        this.targetContainer.removeAllChildren();

        targets.forEach(t => {
            let item = cc.instantiate(this.targetItemPrefab);
            item.parent = this.targetContainer;

            let iconNode = item.getChildByName("Icon");
            if (iconNode) {
                let sprite = iconNode.getComponent(cc.Sprite);
                if (sprite) sprite.spriteFrame = textures[t.id];
            }

            let labelNode = item.getChildByName("Count");
            if (labelNode) {
                let label = labelNode.getComponent(cc.Label);
                if (label) {
                    // Если цель выполнена, рисуем галочку, иначе остаток
                    label.string = t.count <= 0 ? "✅" : `х ${t.count}`; 
                }
            }
        });
    }

    /**
     * Показывает нужное меню (Пауза, Победа, Поражение)
     */
    public showMenu(state: MenuState, currentScore: number, targetScore: number, currentTargets: {id: number, count: number}[], textures: cc.SpriteFrame[]) {
        if (!this.menuUI) return;

        if (this.gameplayUI) this.gameplayUI.active = false;
        this.menuUI.active = true;

        // Отрисовываем актуальные цели
        this.renderTargetIcons(currentTargets, textures);

        this.setupLevelRules();

        if (this.menuScoreLabel) {
            this.menuScoreLabel.node.active = true; 
            this.menuScoreLabel.string = `${currentScore}/${targetScore}`;
        }

        switch (state) {
            case MenuState.PAUSE:
                if (this.scoreHeaderText) this.scoreHeaderText.string = "ОЧКОВ НАБРАНО:"
                if (this.menuTitle) this.menuTitle.string = "ПАУЗА";
                if (this.btnRestart) this.btnRestart.active = true;
                if (this.btnResume) this.btnResume.active = true;
                cc.director.pause(); 
                break;

            case MenuState.WIN:
                if (this.menuTitle) this.menuTitle.string = "ПОБЕДА!";
                if (this.btnRestart) this.btnRestart.active = true;
                if (this.btnResume) this.btnResume.active = false;
                this.prepareEndDisplay(SoundType.WIN);
                break;

            case MenuState.LOSE:
                if (this.scoreHeaderText) this.scoreHeaderText.string = "ОЧКОВ НАБРАНО:"
                if (this.menuTitle) this.menuTitle.string = "ПОРАЖЕНИЕ";
                if (this.btnRestart) this.btnRestart.active = true;
                if (this.btnResume) this.btnResume.active = false;
                this.prepareEndDisplay(SoundType.LOSE);
                break;
        }
    }

    private prepareEndDisplay(soundType: SoundType) {
        if (this.btnResume) this.btnResume.active = false; 
        AudioManager.instance.playSFX(soundType);
    }

    /**
     * Динамически заполняет список целей в пре-игровом меню
     */
    public setupTargetMenu(targets: ITarget[], textures: cc.SpriteFrame[]) {
        if (!this.targetContainer|| !this.targetItemPrefab) return;

        const currentLevel = GlobalData.selectedLevel;
        const config = LEVEL_DATA[currentLevel] || LEVEL_DATA[1];
        
        if (this.menuTitle) this.menuTitle.string = config.levelLable;
        if (this.scoreHeaderText) this.scoreHeaderText.string = "НЕОБХОДИМО ОЧКОВ:";
        if (this.menuScoreLabel) this.menuScoreLabel.string = config.target.toString();

        this.targetContainer.removeAllChildren();

        targets.forEach(t => {
            let item = cc.instantiate(this.targetItemPrefab);
            item.parent = this.targetContainer;

            // Устанавливаем иконку (берем из того же массива, что и кубики)
            let icon = item.getChildByName("Icon").getComponent(cc.Sprite);
            icon.spriteFrame = textures[t.id];

            // Устанавливаем текст
            let label = item.getChildByName("Count").getComponent(cc.Label);
            label.string = `х  ${t.count}`;
        });

        this.setupLevelRules();
    }

    /**
     * Обновляет цели в верхней панели во время игры.
     */
    public updateGameplayTargets(targets: {id: number, count: number}[], textures: cc.SpriteFrame[]) {
        if (!this.gameplayTargetContainer || !this.gameplayTargetItemPrefab) return;

        // Очищаем старые иконки
        this.gameplayTargetContainer.removeAllChildren();

        const allTargets = targets;
        if (allTargets.length === 0) return;

        const layout = this.gameplayTargetContainer.getComponent(cc.Layout);
        
        // Если целей мало (1-3), увеличиваем масштаб
        const scale = allTargets.length <= 3 ? 1.3 : 1.0;

        if (layout) {
            // Устанавливаем размер ячейки (базовый 65x65)
            layout.cellSize = cc.size(65 * scale, 65 * scale);
            layout.spacingX = 20 * scale;
            // Принудительно обновляем Layout, чтобы CONTAINER правильно пересчитал размер
            layout.updateLayout();
        }

        allTargets.forEach(t => {
            let item = cc.instantiate(this.gameplayTargetItemPrefab);
            item.parent = this.gameplayTargetContainer;
            item.scale = scale; // Применяем масштаб к самой ноде

            // Установка иконки
            let iconNode = item.getChildByName("Icon");
            if (iconNode && textures[t.id]) {
                iconNode.getComponent(cc.Sprite).spriteFrame = textures[t.id];
            }

            // Логика текста: число или галочка
            let labelNode = item.getChildByName("Count");
            if (labelNode) {
                let label = labelNode.getComponent(cc.Label);
                if (label) {
                    // Если счетчик 0 или меньше — ставим галочку, иначе — остаток
                    label.string = t.count <= 0 ? "✅" : t.count.toString();
                }
            }
        });
        if (layout) {
            layout.updateLayout();
        }
    }
}