/**
 * LevelConfig — сердце баланса и логики уровней.
 * * ЧТО ЭТО ДЕЛАЕТ:
 * 1. Балансировка: Здесь настраиваются ходы, целевые очки и минимальный размер группы для взрыва (minMatch).
 * 2. Цели: Определяет список объектов (targets), которые игроку нужно собрать для победы.
 * 3. Экономика: Задает количество доступных бустеров на старте каждого уровня.
 * 4. Управление: Позволяет быстро менять сложность игры в одном файле, не залегая в код контроллеров.
 */

export enum ItemID {
    // Обычные блоки
    RED = 4,
    GREEN = 7,
    BLUE = 8,
    YELLOW = 10,
    PURPLE = 12,

    // Бустеры
    BOMB = 5,
    BOMB_MAX = 6,
    ROCKET_V = 9,
    ROCKET_H = 11,  
    STAR = 13,      // Удаляет весь выбраный цвет
    SPAWNER = 14    // Спавнит случайный бустер
}

export interface ITarget {
    id: ItemID;    // Теперь строго используем тип Enum
    count: number; 
}

export const LEVEL_DATA = {
    1: { 
        levelLable: "УРОВЕНЬ 1",
        minMatch: 2,
        moves: 20, 
        target: 200, 
        targets: [
            { id: ItemID.RED, count: 30 },
            { id: ItemID.GREEN, count: 30 }
        ],
        bombs: 0, teleports: 0, removers: 0, spawners: 0, activeBoosters: 0 
    }, 
    2: { 
        levelLable: "УРОВЕНЬ 2",
        minMatch: 2,
        moves: 25, 
        target: 400, 
        targets: [
            { id: ItemID.GREEN, count: 45 },
            { id: ItemID.BLUE, count: 30 },
            { id: ItemID.BOMB, count: 2 },
        ],
        bombs: 1, teleports: 0, removers: 0, spawners: 0, activeBoosters: 1 
    }, 
    3: { 
        levelLable: "УРОВЕНЬ 3",
        minMatch: 2,
        moves: 22, 
        target: 400, 
        targets: [
            { id: ItemID.BOMB_MAX, count: 3 },
            { id: ItemID.YELLOW, count: 50 },
            { id: ItemID.BLUE, count: 50 }
        ],
        bombs: 1, teleports: 2, removers: 0, spawners: 0, activeBoosters: 2 
    }, 
    4: { 
        levelLable: "УРОВЕНЬ 4",
        minMatch: 2,
        moves: 32, 
        target: 600, 
        targets: [
            { id: ItemID.PURPLE, count: 30 },
            { id: ItemID.BOMB, count: 2 },
            { id: ItemID.GREEN, count: 30 },
            { id: ItemID.ROCKET_V, count: 3 }
        ],
        bombs: 2, teleports: 2, removers: 1, spawners: 0, activeBoosters: 3 
    }, 
    5: { 
        levelLable: "УРОВЕНЬ 5",
        minMatch: 3,
        moves: 30, 
        target: 800, 
        targets: [
            { id: ItemID.GREEN, count: 80 },
            { id: ItemID.RED, count: 80 },
            { id: ItemID.ROCKET_V, count: 2 },
            { id: ItemID.ROCKET_H, count: 2 },
            { id: ItemID.STAR, count: 2 }
        ],
        bombs: 2, teleports: 2, removers: 1, spawners: 2, activeBoosters: 4 
    }, 
    6: { 
        levelLable: "УРОВЕНЬ 6",
        minMatch: 3,
        moves: 30, 
        target: 850, 
        targets: [
            { id: ItemID.YELLOW, count: 93 },
            { id: ItemID.RED, count: 93 },
            { id: ItemID.GREEN, count: 93 },
            { id: ItemID.BLUE, count: 93 },
            { id: ItemID.PURPLE, count: 93 },
            { id: ItemID.STAR, count: 5 },
        ],
        bombs: 3, teleports: 2, removers: 2, spawners: 2, activeBoosters: 4 
    }, 
    7: { 
        levelLable: "УРОВЕНЬ 7",
        minMatch: 3,
        moves: 30, 
        target: 900, 
        targets: [
            { id: ItemID.RED, count: 120 },
            { id: ItemID.GREEN, count: 120 },
            { id: ItemID.BOMB_MAX, count: 3 },
            { id: ItemID.ROCKET_H, count: 3 },
            { id: ItemID.ROCKET_V, count: 3 },
            { id: ItemID.STAR, count: 3 }
        ],
        bombs: 1, teleports: 5, removers: 3, spawners: 4, activeBoosters: 4 
    }, 
    8: { 
        levelLable: "УРОВЕНЬ 8",
        minMatch: 4,
        moves: 30, 
        target: 950, 
        targets: [
            { id: ItemID.STAR, count: 7 },
            { id: ItemID.GREEN, count: 130 },
            { id: ItemID.PURPLE, count: 130 },
            { id: ItemID.BLUE, count: 130 },
            { id: ItemID.YELLOW, count: 130 },
            { id: ItemID.RED, count: 130 }
        ],
        bombs: 4, teleports: 5, removers: 3, spawners: 2, activeBoosters: 4 
    }, 
    9: { 
        levelLable: "УРОВЕНЬ 9",
        minMatch: 4,
        moves: 40, 
        target: 1200, 
        targets: [
            { id: ItemID.STAR, count: 8 },
            { id: ItemID.BOMB_MAX, count: 3 },
            { id: ItemID.ROCKET_H, count: 4 },
            { id: ItemID.ROCKET_V, count: 4 },
            { id: ItemID.GREEN, count: 180 },
            { id: ItemID.PURPLE, count: 180 },

        ],
        bombs: 2, teleports: 8, removers: 3, spawners: 2, activeBoosters: 4 
    }, 
    10: { 
        levelLable: "УРОВЕНЬ 10",
        minMatch: 4,
        moves: 45, 
        target: 1400, 
        targets: [
            { id: ItemID.STAR, count: 20 },
            { id: ItemID.GREEN, count: 210 },
            { id: ItemID.PURPLE, count: 210 },
            { id: ItemID.BLUE, count: 210 },
            { id: ItemID.YELLOW, count: 210 },
            { id: ItemID.RED, count: 210 }

        ],
        bombs: 3, teleports: 11, removers: 5, spawners: 3, activeBoosters: 4 
    }  
};