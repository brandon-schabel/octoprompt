import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { CodeTerminal } from '@/components/ui/code-terminal'
import { Play, Pause, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react'

interface DemoStep {
  id: number
  title: string
  description: string
  code?: string
  output?: string
  highlight?: string[]
  duration: number
}

interface LiveDemoProps {
  title: string
  description: string
  steps: DemoStep[]
  onComplete?: () => void
}

export function LiveDemo({ title, description, steps, onComplete }: LiveDemoProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const step = steps[currentStep]

  useEffect(() => {
    if (isPlaying && progress < 100) {
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          const next = prev + 100 / (step.duration / 100)
          if (next >= 100) {
            handleNextStep()
            return 100
          }
          return next
        })
      }, 100)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, progress, step.duration])

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
      setProgress(0)
    } else {
      setIsPlaying(false)
      onComplete?.()
    }
  }

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
      setProgress(0)
    }
  }

  const handleReset = () => {
    setCurrentStep(0)
    setProgress(0)
    setIsPlaying(false)
  }

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='text-center'>
        <h2 className='text-3xl font-bold mb-2'>{title}</h2>
        <p className='text-muted-foreground'>{description}</p>
      </div>

      {/* Progress Bar */}
      <div className='relative h-2 bg-secondary rounded-full overflow-hidden'>
        <motion.div
          className='absolute inset-y-0 left-0 bg-primary'
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Step Indicators */}
      <div className='flex justify-center items-center space-x-4'>
        {steps.map((s, index) => (
          <button
            key={s.id}
            onClick={() => {
              setCurrentStep(index)
              setProgress(0)
              setIsPlaying(false)
            }}
            className={`flex items-center space-x-2 px-3 py-1 rounded-full transition-all ${
              index === currentStep
                ? 'bg-primary text-primary-foreground'
                : index < currentStep
                  ? 'bg-primary/20 text-primary'
                  : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <span className='text-sm font-medium'>{index + 1}</span>
            {index < currentStep && <CheckCircle className='h-4 w-4' />}
          </button>
        ))}
      </div>

      {/* Current Step Content */}
      <AnimatePresence mode='wait'>
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <GlassCard className='p-6'>
            <h3 className='text-xl font-semibold mb-2'>{step.title}</h3>
            <p className='text-muted-foreground mb-6'>{step.description}</p>

            {step.code && (
              <div className='mb-4'>
                <h4 className='text-sm font-medium mb-2'>Code:</h4>
                <CodeTerminal code={step.code} language='typescript' />
              </div>
            )}

            {step.output && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: progress > 50 ? 1 : 0 }}
                transition={{ duration: 0.5 }}
              >
                <h4 className='text-sm font-medium mb-2'>Output:</h4>
                <CodeTerminal code={step.output} language='json' />
              </motion.div>
            )}
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div className='flex justify-center items-center space-x-4'>
        <button
          onClick={handlePreviousStep}
          disabled={currentStep === 0}
          className='btn btn-outline btn-sm disabled:opacity-50'
        >
          Previous
        </button>

        <button onClick={togglePlayPause} className='btn btn-primary btn-sm flex items-center space-x-2'>
          {isPlaying ? (
            <>
              <Pause className='h-4 w-4' />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className='h-4 w-4' />
              <span>Play</span>
            </>
          )}
        </button>

        <button
          onClick={handleNextStep}
          disabled={currentStep === steps.length - 1}
          className='btn btn-outline btn-sm disabled:opacity-50 flex items-center space-x-2'
        >
          <span>Next</span>
          <ArrowRight className='h-4 w-4' />
        </button>

        <button onClick={handleReset} className='btn btn-outline btn-sm'>
          <RefreshCw className='h-4 w-4' />
        </button>
      </div>

      {/* Completion Message */}
      {currentStep === steps.length - 1 && progress === 100 && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className='text-center'>
          <div className='inline-flex items-center space-x-2 text-green-500'>
            <CheckCircle className='h-6 w-6' />
            <span className='font-semibold'>Demo Complete!</span>
          </div>
        </motion.div>
      )}
    </div>
  )
}
