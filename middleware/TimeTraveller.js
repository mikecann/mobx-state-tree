import {
    types,
    onSnapshot,
    applySnapshot,
    getSnapshot,
    getEnv,
    resolvePath,
    getPath
} from "mobx-state-tree"

const TimeTraveller = types
    .model("TimeTraveller", {
        history: types.optional(types.array(types.frozen), []),
        undoIdx: -1,
        targetPath: ""
    })
    .views(self => ({
        get canUndo() {
            return self.undoIdx > 0
        },
        get canRedo() {
            return self.undoIdx < self.history.length - 1
        }
    }))
    .actions(self => {
        let targetStore
        let snapshotDisposer
        let skipNextUndoState = false

        return {
            addUndoState(todos) {
                if (skipNextUndoState) {
                    // skip recording if this state was caused by undo / redo
                    skipNextUndoState = false
                    return
                }
                self.history.splice(self.undoIdx + 1)
                self.history.push(todos)
                self.undoIdx = self.history.length - 1
            },
            afterCreate() {
                targetStore = self.targetPath
                    ? resolvePath(self, self.targetPath)
                    : getEnv(self).targetStore
                if (!targetStore)
                    throw new Error(
                        "Failed to find target store for TimeTraveller. Please provide `targetPath`  property, or a `targetStore` in the environment"
                    )
                // TODO: check if targetStore doesn't contain self
                // if (contains(targetStore, self)) throw new Error("TimeTraveller shouldn't be recording itself. Please specify a sibling as taret, not some parent")
                // start listening to changes
                snapshotDisposer = onSnapshot(targetStore, snapshot => self.addUndoState(snapshot))
                // record an initial state if no known
                if (self.history.length === 0) self.addUndoState(getSnapshot(targetStore))
            },
            beforeDestroy() {
                snapshotDisposer()
            },
            undo() {
                self.undoIdx--
                skipNextUndoState = true
                applySnapshot(targetStore, self.history[self.undoIdx])
            },
            redo() {
                self.undoIdx++
                skipNextUndoState = true
                applySnapshot(targetStore, self.history[self.undoIdx])
            }
        }
    })

export default TimeTraveller
