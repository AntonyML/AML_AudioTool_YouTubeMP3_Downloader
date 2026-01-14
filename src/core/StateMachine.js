// StateMachine.js - Máquina de Estados Explícita
// Gestiona transiciones de estado válidas y previene estados inconsistentes

const STATES = {
    CREATED: 'CREATED',
    QUEUED: 'QUEUED',
    DOWNLOADING: 'DOWNLOADING',
    CANCELLING: 'CANCELLING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR',
    STOPPED: 'STOPPED',
    ALREADY_EXISTS: 'ALREADY_EXISTS'
};

const TRANSITIONS = {
    CREATED: ['QUEUED'],
    QUEUED: ['DOWNLOADING', 'CANCELLING'],
    DOWNLOADING: ['CANCELLING', 'COMPLETED', 'ERROR', 'ALREADY_EXISTS'],
    CANCELLING: ['STOPPED', 'ERROR'],
    COMPLETED: [],
    ERROR: [],
    STOPPED: [],
    ALREADY_EXISTS: []
};

class StateMachine {
    constructor(registry, eventEmitter) {
        this.registry = registry;
        this.emitter = eventEmitter;
    }

    canTransition(fromState, toState) {
        return TRANSITIONS[fromState]?.includes(toState) || false;
    }

    transition(downloadId, toState) {
        const task = this.registry.get(downloadId);
        if (!task) {
            return { success: false, error: 'Download not found' };
        }

        const fromState = task.state;

        if (!this.canTransition(fromState, toState)) {
            return {
                success: false,
                error: `Invalid transition: ${fromState} -> ${toState}`
            };
        }

        this.registry.updateState(downloadId, toState);
        
        this.emitter.emit('state-changed', {
            downloadId,
            fromState,
            toState,
            timestamp: Date.now()
        });

        return { success: true };
    }

    getValidTransitions(downloadId) {
        const task = this.registry.get(downloadId);
        if (!task) return [];
        return TRANSITIONS[task.state] || [];
    }

    isTerminalState(state) {
        return ['COMPLETED', 'ERROR', 'STOPPED'].includes(state);
    }

    isActiveState(state) {
        return ['DOWNLOADING'].includes(state);
    }
}

StateMachine.STATES = STATES;

module.exports = StateMachine;
