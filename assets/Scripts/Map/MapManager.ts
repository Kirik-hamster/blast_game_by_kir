import GlobalData from "../Data/GlobalData";
import AudioManager, { SoundType } from "../Services/AudioManager";
import MapRender from "./MapRender";

const {ccclass, property} = cc._decorator;

const ArrowCoords = {
    // Нижний сегмент стрелок
    BG1: [255, 390, 895], 

    // Средние сегменты стрелок
    BG2: [-895, -390, -255, 255, 390, 895],
    BG3: [-895, -390, -255, 255, 390, 895],

    // Верхний сегмент стрелок
    BG4: [-895, -390, -255]
};

@ccclass
export default class MapManager extends cc.Component {
    @property([cc.Node]) levelButtons: cc.Node[] = []; // lvl1, lvl2... в порядке очереди
    @property(cc.Prefab) starsPrefab: cc.Prefab = null;
    @property(cc.SpriteFrame) lockedTexture: cc.SpriteFrame = null;
    @property(cc.SpriteFrame) unlockedTexture: cc.SpriteFrame = null;

    // Те самые 4 переменные для фонов
    @property(MapRender) bg1: MapRender = null;
    @property(MapRender) bg2: MapRender = null;
    @property(MapRender) bg3: MapRender = null;
    @property(MapRender) bg4: MapRender = null;

    start() {
        this.initMapArrows();
        this.setupLevels();
    }

    private setupLevels() {
        const unlockedLevel = GlobalData.getUnlockedLevel();

        this.levelButtons.forEach((btnNode, index) => {
            const levelId = index + 1; // Уровень начинается с 1
            const isUnlocked = levelId <= unlockedLevel;
            const starsCount = GlobalData.getStarsForLevel(levelId);

            // Настройка текстуры и кликабельности
            const sprite = btnNode.getComponent(cc.Sprite);
            const button = btnNode.getComponent(cc.Button);

            if (sprite) {
                sprite.spriteFrame = isUnlocked ? this.unlockedTexture : this.lockedTexture;
            }

            if (button) {
                button.interactable = isUnlocked; // Если false — нет звуков и кликов
                button.enableAutoGrayEffect = false; 
            }
            const labelNode = btnNode.getChildByName(`lvl${levelId}Lable`);
            if (labelNode) labelNode.active = isUnlocked;

            // Создаем префаб звезд под кнопкой
            if (isUnlocked) {
                this.spawnStarsUnderButton(btnNode, starsCount);
            }
        });
    }

    private spawnStarsUnderButton(btnNode: cc.Node, count: number) {
        let starsNode = cc.instantiate(this.starsPrefab);
        starsNode.parent = btnNode;
        
        // ТЗ: Всегда по y -100 относительно кнопки
        starsNode.setPosition(0, -88);
        starsNode.scale = 0.5; // Подбери нужный размер

        // Настройка звезд внутри префаба
        starsNode.children.forEach((star, index) => {
            // Если звезда заработана — непрозрачная (255), если нет — полупрозрачная (100)
            star.opacity = (index < count) ? 255 : 100;
        });
    }

    private initMapArrows() {
        // Рисуем стрелки на фонах
        if (this.bg1) {
            this.bg1.drawArrows(ArrowCoords.BG1);
        }
        if (this.bg2) {
            this.bg2.drawArrows(ArrowCoords.BG2);
        }
        if (this.bg3) {
            this.bg3.drawArrows(ArrowCoords.BG3);
        }
        if (this.bg4) {
            this.bg4.drawArrows(ArrowCoords.BG4);
        }
    }

    // Исправленная сигнатура: event первый, твои данные — вторые
    public onLevelClick(event: cc.Event, customEventData: string) {
        // Теперь customEventData — это действительно строка с номером уровня
        const levelId = parseInt(customEventData);
        
        if (!isNaN(levelId)) {
            GlobalData.selectedLevel = levelId;
            console.log("Выбран уровень:", GlobalData.selectedLevel);
        } else {
            cc.error("Ошибка: CustomEventData в инспекторе пуст или содержит не число!");
            GlobalData.selectedLevel = 1; // Запасной вариант
        }

        if (AudioManager.instance) {
            AudioManager.instance.playSFX(SoundType.SMALL);
        }

        cc.director.loadScene("MainScene"); 
    }
}