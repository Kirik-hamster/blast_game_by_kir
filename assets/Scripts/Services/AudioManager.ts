/**
 * AudioManager — главный по звукам. 
 * * ЧТО ЭТО ДЕЛАЕТ:
 * 1. Singleton: Доступен из любого скрипта через AudioManager.instance.
 * 2. Persistence: Узел не удаляется при переходе между сценами (карта <-> уровень), музыка и звуки не прерываются.
 * 3. SFX Player: Проигрывает все эффекты (клики, взрывы, ракеты) по ключам из SoundType.
 * 4. Safe Play: Проверяет наличие клипа перед запуском, чтобы игра не крашнулась, если в инспекторе что-то забыли.
 */

const {ccclass, property} = cc._decorator;

export enum SoundType {
    SMALL = "soundSmall",
    BIG = "soundBig",
    ROCKET = "rocket",
    BOMB_SMALL = "bombSmall",
    BOMB_BIG = "bombBig",
    WIN = "soundWin",
    LOSE = "soundLose",
    SHUFFLE = "soundShuffle"
}

@ccclass
export default class AudioManager extends cc.Component {
    public static instance: AudioManager = null;

    @property(cc.AudioClip) soundSmall: cc.AudioClip = null;
    @property(cc.AudioClip) soundBig: cc.AudioClip = null;
    @property(cc.AudioClip) rocket: cc.AudioClip = null;
    @property(cc.AudioClip) bombSmall: cc.AudioClip = null;
    @property(cc.AudioClip) bombBig: cc.AudioClip = null;
    @property(cc.AudioClip) soundWin: cc.AudioClip = null;
    @property(cc.AudioClip) soundLose: cc.AudioClip = null;
    @property(cc.AudioClip) soundShuffle: cc.AudioClip = null;

    onLoad() {
        if (this.node.parent !== cc.director.getScene()) {
            // Если узел внутри другого узла, выносим его в корень, иначе он удалится со сценой
            this.node.parent = cc.director.getScene();
        }
        // Если инстанс еще не установлен — устанавливаем
        if (AudioManager.instance === null) {
            AudioManager.instance = this;
            cc.game.addPersistRootNode(this.node);
        } else {
            // Если инстанс уже есть, новый узел нам не нужен — удаляем его сразу
            this.node.destroy();
            return; 
        }
    }
    /**
     * Простой метод для теста: играет звук без проверок
     */
    public playSFX(type: SoundType) {
        const clip = this[type]; // Берем клип по ключу из Enum
        if (clip) {
            cc.audioEngine.playEffect(clip, false);
        } else {
            cc.warn(`Звук ${type} не найден в AudioManager!`);
        }
    }
}