/***************************************************************************************************
 * File: packages/server/routes/ui-generation-routes.ts
 * Minimal REST endpoints for UI generation
 **************************************************************************************************/
import { router } from "server-router"
import { json } from "@bnk/router"
import {
    generateUI,
    undoUI,
    redoUI,
    lockSeed,
    getCurrentSeedSnapshot,
    type UIGeneratorRequest
} from "@/services/ui-generation-service"
import { uiGenerationApiValidation } from "shared"

router.post("/api/ui-gen/generate", {
    validation: {
        body: uiGenerationApiValidation.generate.body
    }
}, async (_, { body }) => {
    const { seedId, output } = await generateUI(body as UIGeneratorRequest)
    return json({ success: true, seedId, output })
})

router.post("/api/ui-gen/undo", {
    validation: {
        body: uiGenerationApiValidation.undoRedo.body
    }
}, async (_, { body }) => {
    const snapshot = undoUI(body.seedId as string)
    return json({ success: true, snapshot })
})

router.post("/api/ui-gen/redo", {
    validation: {
        body: uiGenerationApiValidation.undoRedo.body
    }
}, async (_, { body }) => {
    const snapshot = redoUI(body.seedId as string)
    return json({ success: true, snapshot })
})

router.post("/api/ui-gen/lock", {
    validation: {
        body: uiGenerationApiValidation.lock.body
    }
}, async (_, { body }) => {
    lockSeed(body.seedId as string)
    return json({ success: true, message: `Seed ${body.seedId} locked` })
})

router.get("/api/ui-gen/snapshot/:seedId", {
    validation: {
        params: uiGenerationApiValidation.getSnapshot.params
    }
}, async (_, { params }) => {
    const snapshot = getCurrentSeedSnapshot(params.seedId as string)
    return json({ success: true, snapshot })
})