const {ccclass, property} = cc._decorator;

@ccclass
export default class MapRender extends cc.Component {
    @property(cc.Prefab) arrowPrefab: cc.Prefab = null;
    

    public drawArrows(positions: number[]) {
        this.node.children.forEach(child => {
            if (child.name === "arrow") child.destroy();
        });
        // Теперь используем переданный массив positions
        positions.forEach(y => {
            let arrow = cc.instantiate(this.arrowPrefab);
            arrow.parent = this.node;
            arrow.name = "arrow"; 
            arrow.setPosition(0, y);
        });
    }
} 