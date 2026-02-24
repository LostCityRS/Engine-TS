import Linkable from '#/datastruct/Linkable.js';

import NonPathingEntity from './NonPathingEntity.js';

export default class LocObjEvent extends Linkable {
    entity: NonPathingEntity;

    constructor(entity: NonPathingEntity) {
        super();
        this.entity = entity;
        entity.eventTracker = this;
    }

    check(): boolean {
        return this === this.entity.eventTracker;
    }
}
