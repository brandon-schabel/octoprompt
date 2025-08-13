/**
 * Statistical Analysis Module for Rigorous Benchmarking
 * Implements A/B testing, bootstrap resampling, and statistical significance testing
 */

import { E, pipe } from '../../src/fp'

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ABTestResult {
  groupA: {
    mean: number
    variance: number
    size: number
  }
  groupB: {
    mean: number
    variance: number
    size: number
  }
  pValue: number
  significant: boolean
  effectSize: {
    cohensD: number
    interpretation: string
  }
  confidence: {
    level: number
    intervalA: [number, number]
    intervalB: [number, number]
  }
  power: number
  requiredSampleSize: number
}

export interface BootstrapResult {
  originalStatistic: number
  bootstrapMean: number
  standardError: number
  bias: number
  confidenceInterval: {
    lower: number
    upper: number
    level: number
  }
  percentiles: {
    p5: number
    p25: number
    p50: number
    p75: number
    p95: number
  }
  samples: number[]
}

export interface MultipleComparisonResult {
  comparisons: Array<{
    name: string
    pValue: number
    adjustedPValue: number
    significant: boolean
  }>
  method: 'bonferroni' | 'benjamini-hochberg' | 'holm-bonferroni'
  overallSignificance: boolean
  falseDiscoveryRate: number
}

export interface PowerAnalysisResult {
  achievedPower: number
  requiredSampleSize: number
  detectionThreshold: number
  alpha: number
  beta: number
  effectSize: number
}

export interface SampleSizeCalculation {
  requiredSize: number
  confidence: number
  marginOfError: number
  populationProportion: number
  finite: boolean
  populationSize?: number
}

export interface VarianceReductionResult {
  originalVariance: number
  reducedVariance: number
  reductionPercentage: number
  method: string
  controlVariates?: number[]
}

// ============================================================================
// A/B Testing Implementation
// ============================================================================

export class ABTesting {
  /**
   * Perform comprehensive A/B test with effect size and power analysis
   */
  static test(
    groupA: number[],
    groupB: number[],
    options: {
      alpha?: number
      confidenceLevel?: number
      twoTailed?: boolean
      equalVariance?: boolean
    } = {}
  ): ABTestResult {
    const {
      alpha = 0.05,
      confidenceLevel = 0.95,
      twoTailed = true,
      equalVariance = true
    } = options

    // Calculate basic statistics
    const statsA = this.calculateStats(groupA)
    const statsB = this.calculateStats(groupB)

    // Perform appropriate t-test
    const pValue = equalVariance
      ? this.studentTTest(groupA, groupB, twoTailed)
      : this.welchTTest(groupA, groupB, twoTailed)

    // Calculate effect size
    const effectSize = this.calculateEffectSize(groupA, groupB)

    // Calculate confidence intervals
    const confidenceA = this.confidenceInterval(groupA, confidenceLevel)
    const confidenceB = this.confidenceInterval(groupB, confidenceLevel)

    // Power analysis
    const power = this.calculatePower(effectSize.cohensD, groupA.length, groupB.length, alpha)
    const requiredSize = this.calculateRequiredSampleSize(effectSize.cohensD, alpha, 0.8)

    return {
      groupA: statsA,
      groupB: statsB,
      pValue,
      significant: pValue < alpha,
      effectSize,
      confidence: {
        level: confidenceLevel,
        intervalA: confidenceA,
        intervalB: confidenceB
      },
      power,
      requiredSampleSize: requiredSize
    }
  }

  /**
   * Calculate basic statistics for a group
   */
  private static calculateStats(group: number[]): ABTestResult['groupA'] {
    const mean = this.mean(group)
    const variance = this.variance(group)
    return { mean, variance, size: group.length }
  }

  /**
   * Student's t-test (equal variance)
   */
  private static studentTTest(groupA: number[], groupB: number[], twoTailed: boolean): number {
    const n1 = groupA.length
    const n2 = groupB.length
    const mean1 = this.mean(groupA)
    const mean2 = this.mean(groupB)

    // Pooled standard deviation
    const s1 = this.standardDeviation(groupA)
    const s2 = this.standardDeviation(groupB)
    const pooledSD = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2))

    // t-statistic
    const standardError = pooledSD * Math.sqrt(1 / n1 + 1 / n2)
    const t = (mean1 - mean2) / standardError

    // Degrees of freedom
    const df = n1 + n2 - 2

    // p-value (using approximation)
    const pValue = this.tDistributionCDF(Math.abs(t), df)

    return twoTailed ? 2 * (1 - pValue) : (1 - pValue)
  }

  /**
   * Welch's t-test (unequal variance)
   */
  private static welchTTest(groupA: number[], groupB: number[], twoTailed: boolean): number {
    const n1 = groupA.length
    const n2 = groupB.length
    const mean1 = this.mean(groupA)
    const mean2 = this.mean(groupB)
    const var1 = this.variance(groupA)
    const var2 = this.variance(groupB)

    // Welch's t-statistic
    const standardError = Math.sqrt(var1 / n1 + var2 / n2)
    const t = (mean1 - mean2) / standardError

    // Welch-Satterthwaite degrees of freedom
    const numerator = Math.pow(var1 / n1 + var2 / n2, 2)
    const denominator = Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1)
    const df = numerator / denominator

    // p-value
    const pValue = this.tDistributionCDF(Math.abs(t), df)

    return twoTailed ? 2 * (1 - pValue) : (1 - pValue)
  }

  /**
   * Calculate Cohen's d effect size
   */
  private static calculateEffectSize(groupA: number[], groupB: number[]): ABTestResult['effectSize'] {
    const mean1 = this.mean(groupA)
    const mean2 = this.mean(groupB)
    const pooledSD = this.pooledStandardDeviation(groupA, groupB)

    const cohensD = pooledSD > 0 ? (mean2 - mean1) / pooledSD : 0

    let interpretation: string
    const absCohensD = Math.abs(cohensD)
    if (absCohensD < 0.2) interpretation = 'negligible'
    else if (absCohensD < 0.5) interpretation = 'small'
    else if (absCohensD < 0.8) interpretation = 'medium'
    else interpretation = 'large'

    return {
      cohensD: Math.round(cohensD * 1000) / 1000,
      interpretation
    }
  }

  /**
   * Calculate confidence interval
   */
  private static confidenceInterval(data: number[], confidence: number): [number, number] {
    const mean = this.mean(data)
    const standardError = this.standardDeviation(data) / Math.sqrt(data.length)
    const z = this.getZScore(confidence)

    return [
      mean - z * standardError,
      mean + z * standardError
    ]
  }

  /**
   * Calculate statistical power
   */
  private static calculatePower(effectSize: number, n1: number, n2: number, alpha: number): number {
    const ncp = Math.abs(effectSize) * Math.sqrt((n1 * n2) / (n1 + n2))
    const criticalValue = this.getZScore(1 - alpha / 2)
    const power = 1 - this.normalCDF(criticalValue - ncp)
    return Math.round(power * 1000) / 1000
  }

  /**
   * Calculate required sample size for desired power
   */
  private static calculateRequiredSampleSize(effectSize: number, alpha: number, power: number): number {
    const za = this.getZScore(1 - alpha / 2)
    const zb = this.getZScore(power)
    const n = 2 * Math.pow((za + zb) / effectSize, 2)
    return Math.ceil(n)
  }

  // Utility functions
  private static mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private static variance(values: number[]): number {
    const m = this.mean(values)
    return values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (values.length - 1)
  }

  private static standardDeviation(values: number[]): number {
    return Math.sqrt(this.variance(values))
  }

  private static pooledStandardDeviation(groupA: number[], groupB: number[]): number {
    const n1 = groupA.length
    const n2 = groupB.length
    const var1 = this.variance(groupA)
    const var2 = this.variance(groupB)

    const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2)
    return Math.sqrt(pooledVar)
  }

  private static getZScore(probability: number): number {
    // Approximate inverse normal CDF
    const a0 = 2.50662823884
    const a1 = -18.61500062529
    const a2 = 41.39119773534
    const a3 = -25.44106049637

    const b0 = -8.47351093090
    const b1 = 23.08336743743
    const b2 = -21.06224101826
    const b3 = 3.13082909833

    const c0 = 0.3374754822726147
    const c1 = 0.9761690190917186
    const c2 = 0.1607979714918209
    const c3 = 0.0276438810333863
    const c4 = 0.0038405729373609
    const c5 = 0.0003951896511919
    const c6 = 0.0000321767881768
    const c7 = 0.0000002888167364
    const c8 = 0.0000003960315187

    const p = probability
    const q = 1 - p

    if (p < 0.5) {
      const r = Math.sqrt(-Math.log(p))
      return (((((((c8 * r + c7) * r + c6) * r + c5) * r + c4) * r + c3) * r + c2) * r + c1) * r + c0
    } else {
      const r = Math.sqrt(-Math.log(q))
      return -(((((((c8 * r + c7) * r + c6) * r + c5) * r + c4) * r + c3) * r + c2) * r + c1) * r - c0
    }
  }

  private static normalCDF(x: number): number {
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911

    const sign = x < 0 ? -1 : 1
    x = Math.abs(x) / Math.sqrt(2.0)

    const t = 1.0 / (1.0 + p * x)
    const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
    
    return 0.5 * (1.0 + sign * y)
  }

  private static tDistributionCDF(t: number, df: number): number {
    // Approximation using normal distribution for large df
    if (df > 30) {
      return this.normalCDF(t)
    }

    // Simple approximation for small df
    const x = df / (df + t * t)
    const a = df / 2
    const b = 0.5

    // Incomplete beta function approximation
    return 0.5 * (1 + this.incompleteBeta(x, a, b))
  }

  private static incompleteBeta(x: number, a: number, b: number): number {
    // Very simple approximation
    if (x <= 0) return 0
    if (x >= 1) return 1

    // Use series expansion for small x
    if (x < (a + 1) / (a + b + 2)) {
      return this.betaSeries(x, a, b)
    }

    // Use continued fraction for large x
    return 1 - this.betaSeries(1 - x, b, a)
  }

  private static betaSeries(x: number, a: number, b: number): number {
    const maxIterations = 100
    const epsilon = 1e-10

    let sum = 0
    let term = 1

    for (let n = 0; n < maxIterations; n++) {
      if (Math.abs(term) < epsilon) break

      sum += term
      term *= (a + n) * x / (n + 1)
    }

    return sum * Math.pow(x, a) * Math.pow(1 - x, b) / a
  }
}

// ============================================================================
// Bootstrap Resampling
// ============================================================================

export class BootstrapResampling {
  /**
   * Perform bootstrap resampling for confidence intervals
   */
  static bootstrap(
    data: number[],
    statistic: (sample: number[]) => number,
    options: {
      iterations?: number
      confidenceLevel?: number
      seed?: number
    } = {}
  ): BootstrapResult {
    const {
      iterations = 10000,
      confidenceLevel = 0.95,
      seed = Date.now()
    } = options

    // Initialize random number generator with seed
    let rng = this.seedRandom(seed)

    // Calculate original statistic
    const originalStatistic = statistic(data)

    // Perform bootstrap sampling
    const bootstrapStats: number[] = []
    for (let i = 0; i < iterations; i++) {
      const sample = this.resample(data, rng)
      bootstrapStats.push(statistic(sample))
    }

    // Sort for percentile calculations
    bootstrapStats.sort((a, b) => a - b)

    // Calculate bootstrap statistics
    const bootstrapMean = this.mean(bootstrapStats)
    const standardError = this.standardDeviation(bootstrapStats)
    const bias = bootstrapMean - originalStatistic

    // Calculate confidence interval
    const alpha = 1 - confidenceLevel
    const lowerIndex = Math.floor((alpha / 2) * iterations)
    const upperIndex = Math.floor((1 - alpha / 2) * iterations)

    const confidenceInterval = {
      lower: bootstrapStats[lowerIndex],
      upper: bootstrapStats[upperIndex],
      level: confidenceLevel
    }

    // Calculate percentiles
    const percentiles = {
      p5: bootstrapStats[Math.floor(0.05 * iterations)],
      p25: bootstrapStats[Math.floor(0.25 * iterations)],
      p50: bootstrapStats[Math.floor(0.50 * iterations)],
      p75: bootstrapStats[Math.floor(0.75 * iterations)],
      p95: bootstrapStats[Math.floor(0.95 * iterations)]
    }

    return {
      originalStatistic,
      bootstrapMean,
      standardError,
      bias,
      confidenceInterval,
      percentiles,
      samples: bootstrapStats
    }
  }

  /**
   * BCa (Bias-Corrected and accelerated) bootstrap
   */
  static bcaBootstrap(
    data: number[],
    statistic: (sample: number[]) => number,
    options: {
      iterations?: number
      confidenceLevel?: number
    } = {}
  ): BootstrapResult {
    const basicBootstrap = this.bootstrap(data, statistic, options)

    // Calculate bias correction
    const z0 = this.calculateBiasCorrection(basicBootstrap.samples, basicBootstrap.originalStatistic)

    // Calculate acceleration
    const acceleration = this.calculateAcceleration(data, statistic)

    // Adjust confidence intervals
    const alpha = 1 - (options.confidenceLevel || 0.95)
    const z_alpha_lower = this.inverseNormalCDF(alpha / 2)
    const z_alpha_upper = this.inverseNormalCDF(1 - alpha / 2)

    const alpha_lower = this.normalCDF(z0 + (z0 + z_alpha_lower) / (1 - acceleration * (z0 + z_alpha_lower)))
    const alpha_upper = this.normalCDF(z0 + (z0 + z_alpha_upper) / (1 - acceleration * (z0 + z_alpha_upper)))

    const lowerIndex = Math.floor(alpha_lower * basicBootstrap.samples.length)
    const upperIndex = Math.floor(alpha_upper * basicBootstrap.samples.length)

    return {
      ...basicBootstrap,
      confidenceInterval: {
        lower: basicBootstrap.samples[lowerIndex],
        upper: basicBootstrap.samples[upperIndex],
        level: options.confidenceLevel || 0.95
      }
    }
  }

  /**
   * Resample with replacement
   */
  private static resample(data: number[], rng: () => number): number[] {
    const n = data.length
    const sample: number[] = []

    for (let i = 0; i < n; i++) {
      const index = Math.floor(rng() * n)
      sample.push(data[index])
    }

    return sample
  }

  /**
   * Seeded random number generator
   */
  private static seedRandom(seed: number): () => number {
    let state = seed

    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
  }

  /**
   * Calculate bias correction for BCa
   */
  private static calculateBiasCorrection(bootstrapSamples: number[], originalStat: number): number {
    const proportion = bootstrapSamples.filter(s => s < originalStat).length / bootstrapSamples.length
    return this.inverseNormalCDF(proportion)
  }

  /**
   * Calculate acceleration for BCa using jackknife
   */
  private static calculateAcceleration(data: number[], statistic: (sample: number[]) => number): number {
    const n = data.length
    const jackknifeSamples: number[] = []

    // Calculate jackknife samples
    for (let i = 0; i < n; i++) {
      const sample = [...data.slice(0, i), ...data.slice(i + 1)]
      jackknifeSamples.push(statistic(sample))
    }

    const mean = this.mean(jackknifeSamples)
    const diffs = jackknifeSamples.map(s => mean - s)

    const sumCubed = diffs.reduce((sum, d) => sum + Math.pow(d, 3), 0)
    const sumSquared = diffs.reduce((sum, d) => sum + Math.pow(d, 2), 0)

    return sumCubed / (6 * Math.pow(sumSquared, 1.5))
  }

  // Utility functions
  private static mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private static standardDeviation(values: number[]): number {
    const m = this.mean(values)
    const variance = values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (values.length - 1)
    return Math.sqrt(variance)
  }

  private static normalCDF(x: number): number {
    return ABTesting['normalCDF'](x)
  }

  private static inverseNormalCDF(p: number): number {
    return ABTesting['getZScore'](p)
  }
}

// ============================================================================
// Multiple Comparison Corrections
// ============================================================================

export class MultipleComparisons {
  /**
   * Apply Benjamini-Hochberg correction for multiple comparisons
   */
  static benjaminiHochberg(
    pValues: Array<{ name: string; pValue: number }>,
    alpha: number = 0.05
  ): MultipleComparisonResult {
    // Sort p-values
    const sorted = [...pValues].sort((a, b) => a.pValue - b.pValue)
    const m = sorted.length

    // Apply Benjamini-Hochberg procedure
    const comparisons = sorted.map((item, i) => {
      const rank = i + 1
      const threshold = (rank / m) * alpha
      const adjustedP = Math.min(1, item.pValue * m / rank)

      return {
        name: item.name,
        pValue: item.pValue,
        adjustedPValue: adjustedP,
        significant: item.pValue <= threshold
      }
    })

    // Calculate false discovery rate
    const significantCount = comparisons.filter(c => c.significant).length
    const fdr = significantCount > 0 ? alpha * significantCount / m : 0

    return {
      comparisons,
      method: 'benjamini-hochberg',
      overallSignificance: significantCount > 0,
      falseDiscoveryRate: fdr
    }
  }

  /**
   * Apply Bonferroni correction
   */
  static bonferroni(
    pValues: Array<{ name: string; pValue: number }>,
    alpha: number = 0.05
  ): MultipleComparisonResult {
    const m = pValues.length
    const adjustedAlpha = alpha / m

    const comparisons = pValues.map(item => ({
      name: item.name,
      pValue: item.pValue,
      adjustedPValue: Math.min(1, item.pValue * m),
      significant: item.pValue <= adjustedAlpha
    }))

    const significantCount = comparisons.filter(c => c.significant).length

    return {
      comparisons,
      method: 'bonferroni',
      overallSignificance: significantCount > 0,
      falseDiscoveryRate: 0 // Bonferroni controls FWER, not FDR
    }
  }

  /**
   * Apply Holm-Bonferroni correction (step-down method)
   */
  static holmBonferroni(
    pValues: Array<{ name: string; pValue: number }>,
    alpha: number = 0.05
  ): MultipleComparisonResult {
    // Sort p-values
    const sorted = [...pValues].sort((a, b) => a.pValue - b.pValue)
    const m = sorted.length

    const comparisons: MultipleComparisonResult['comparisons'] = []
    let rejectAll = false

    for (let i = 0; i < m; i++) {
      const adjustedAlpha = alpha / (m - i)
      const adjustedP = Math.min(1, sorted[i].pValue * (m - i))

      if (!rejectAll && sorted[i].pValue > adjustedAlpha) {
        rejectAll = true
      }

      comparisons.push({
        name: sorted[i].name,
        pValue: sorted[i].pValue,
        adjustedPValue: adjustedP,
        significant: !rejectAll && sorted[i].pValue <= adjustedAlpha
      })
    }

    const significantCount = comparisons.filter(c => c.significant).length

    return {
      comparisons,
      method: 'holm-bonferroni',
      overallSignificance: significantCount > 0,
      falseDiscoveryRate: 0
    }
  }
}

// ============================================================================
// Power Analysis
// ============================================================================

export class PowerAnalysis {
  /**
   * Calculate statistical power for a given sample size and effect size
   */
  static calculatePower(
    effectSize: number,
    sampleSize: number,
    alpha: number = 0.05,
    twoTailed: boolean = true
  ): PowerAnalysisResult {
    const criticalValue = ABTesting['getZScore'](1 - (twoTailed ? alpha / 2 : alpha))
    const ncp = Math.abs(effectSize) * Math.sqrt(sampleSize)
    const power = 1 - ABTesting['normalCDF'](criticalValue - ncp)

    // Calculate beta (Type II error rate)
    const beta = 1 - power

    // Calculate minimum detectable effect
    const detectionThreshold = criticalValue / Math.sqrt(sampleSize)

    // Calculate required sample size for 80% power
    const targetPower = 0.8
    const zBeta = ABTesting['getZScore'](targetPower)
    const requiredSize = Math.ceil(Math.pow((criticalValue + zBeta) / effectSize, 2))

    return {
      achievedPower: Math.round(power * 1000) / 1000,
      requiredSampleSize: requiredSize,
      detectionThreshold: Math.round(detectionThreshold * 1000) / 1000,
      alpha,
      beta: Math.round(beta * 1000) / 1000,
      effectSize
    }
  }

  /**
   * Calculate required sample size for desired power
   */
  static calculateSampleSize(
    effectSize: number,
    desiredPower: number = 0.8,
    alpha: number = 0.05,
    twoTailed: boolean = true
  ): number {
    const zAlpha = ABTesting['getZScore'](1 - (twoTailed ? alpha / 2 : alpha))
    const zBeta = ABTesting['getZScore'](desiredPower)

    const n = Math.pow((zAlpha + zBeta) / effectSize, 2)

    return Math.ceil(n)
  }

  /**
   * Post-hoc power analysis
   */
  static postHocPower(
    observedEffect: number,
    sampleSize: number,
    alpha: number = 0.05
  ): PowerAnalysisResult {
    return this.calculatePower(observedEffect, sampleSize, alpha)
  }
}

// ============================================================================
// Sample Size Calculations
// ============================================================================

export class SampleSizeCalculator {
  /**
   * Calculate sample size for proportion estimation
   */
  static forProportion(
    marginOfError: number,
    confidenceLevel: number = 0.95,
    populationProportion: number = 0.5,
    populationSize?: number
  ): SampleSizeCalculation {
    const z = ABTesting['getZScore'](confidenceLevel)

    // Infinite population formula
    let n = Math.pow(z, 2) * populationProportion * (1 - populationProportion) / Math.pow(marginOfError, 2)

    // Finite population correction
    let finite = false
    if (populationSize && populationSize < 10000) {
      finite = true
      n = n / (1 + (n - 1) / populationSize)
    }

    return {
      requiredSize: Math.ceil(n),
      confidence: confidenceLevel,
      marginOfError,
      populationProportion,
      finite,
      populationSize
    }
  }

  /**
   * Calculate sample size for mean estimation
   */
  static forMean(
    marginOfError: number,
    standardDeviation: number,
    confidenceLevel: number = 0.95,
    populationSize?: number
  ): number {
    const z = ABTesting['getZScore'](confidenceLevel)

    let n = Math.pow(z * standardDeviation / marginOfError, 2)

    // Finite population correction
    if (populationSize && populationSize < 10000) {
      n = n / (1 + (n - 1) / populationSize)
    }

    return Math.ceil(n)
  }

  /**
   * Calculate sample size for A/B test
   */
  static forABTest(
    minimumDetectableEffect: number,
    baselineConversion: number,
    power: number = 0.8,
    alpha: number = 0.05,
    twoTailed: boolean = true
  ): number {
    const zAlpha = ABTesting['getZScore'](1 - (twoTailed ? alpha / 2 : alpha))
    const zBeta = ABTesting['getZScore'](power)

    const p1 = baselineConversion
    const p2 = baselineConversion + minimumDetectableEffect
    const pBar = (p1 + p2) / 2

    const n = 2 * Math.pow(zAlpha + zBeta, 2) * pBar * (1 - pBar) / Math.pow(minimumDetectableEffect, 2)

    return Math.ceil(n)
  }
}

// ============================================================================
// Variance Reduction Techniques
// ============================================================================

export class VarianceReduction {
  /**
   * Apply control variates method
   */
  static controlVariates(
    data: number[],
    controlData: number[],
    targetStatistic: (sample: number[]) => number
  ): VarianceReductionResult {
    // Calculate correlation
    const correlation = this.correlation(data, controlData)

    // Calculate optimal coefficient
    const varY = this.variance(data)
    const varX = this.variance(controlData)
    const optimalCoeff = correlation * Math.sqrt(varY / varX)

    // Apply control variates
    const meanX = this.mean(controlData)
    const adjustedData = data.map((y, i) => y - optimalCoeff * (controlData[i] - meanX))

    // Calculate variance reduction
    const originalVariance = this.variance(data)
    const reducedVariance = this.variance(adjustedData)
    const reductionPercentage = ((originalVariance - reducedVariance) / originalVariance) * 100

    return {
      originalVariance,
      reducedVariance,
      reductionPercentage: Math.round(reductionPercentage * 100) / 100,
      method: 'control-variates',
      controlVariates: adjustedData
    }
  }

  /**
   * Apply stratified sampling
   */
  static stratifiedSampling(
    data: number[],
    strata: number[],
    targetStatistic: (sample: number[]) => number
  ): VarianceReductionResult {
    // Group data by strata
    const groups = new Map<number, number[]>()
    data.forEach((value, i) => {
      const stratum = strata[i]
      if (!groups.has(stratum)) {
        groups.set(stratum, [])
      }
      groups.get(stratum)!.push(value)
    })

    // Calculate stratified mean
    let stratifiedMean = 0
    let stratifiedVariance = 0
    const n = data.length

    groups.forEach((group, stratum) => {
      const weight = group.length / n
      const groupMean = this.mean(group)
      const groupVar = this.variance(group)

      stratifiedMean += weight * groupMean
      stratifiedVariance += weight * groupVar
    })

    // Original variance
    const originalVariance = this.variance(data)

    const reductionPercentage = ((originalVariance - stratifiedVariance) / originalVariance) * 100

    return {
      originalVariance,
      reducedVariance: stratifiedVariance,
      reductionPercentage: Math.round(reductionPercentage * 100) / 100,
      method: 'stratified-sampling'
    }
  }

  /**
   * Apply antithetic variates
   */
  static antitheticVariates(
    data: number[],
    generator: () => number,
    iterations: number = 1000
  ): VarianceReductionResult {
    const regular: number[] = []
    const antithetic: number[] = []

    for (let i = 0; i < iterations; i++) {
      const u = generator()
      regular.push(u)
      antithetic.push(1 - u)
    }

    // Combine regular and antithetic
    const combined = regular.map((r, i) => (r + antithetic[i]) / 2)

    const originalVariance = this.variance(regular)
    const reducedVariance = this.variance(combined)
    const reductionPercentage = ((originalVariance - reducedVariance) / originalVariance) * 100

    return {
      originalVariance,
      reducedVariance,
      reductionPercentage: Math.round(reductionPercentage * 100) / 100,
      method: 'antithetic-variates'
    }
  }

  // Utility functions
  private static mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private static variance(values: number[]): number {
    const m = this.mean(values)
    return values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (values.length - 1)
  }

  private static correlation(x: number[], y: number[]): number {
    const n = x.length
    const meanX = this.mean(x)
    const meanY = this.mean(y)

    let numerator = 0
    let denomX = 0
    let denomY = 0

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX
      const dy = y[i] - meanY
      numerator += dx * dy
      denomX += dx * dx
      denomY += dy * dy
    }

    return numerator / Math.sqrt(denomX * denomY)
  }
}

// ============================================================================
// Statistical Testing Suite
// ============================================================================

export class StatisticalTestingSuite {
  /**
   * Run comprehensive statistical tests on benchmark results
   */
  static runFullAnalysis(
    baseline: number[],
    treatment: number[],
    options: {
      alpha?: number
      confidenceLevel?: number
      bootstrapIterations?: number
      multipleComparisons?: Array<{ name: string; pValue: number }>
    } = {}
  ): {
    abTest: ABTestResult
    bootstrap: BootstrapResult
    powerAnalysis: PowerAnalysisResult
    sampleSize: SampleSizeCalculation
    multipleComparisons?: MultipleComparisonResult
  } {
    // Run A/B test
    const abTest = ABTesting.test(baseline, treatment, {
      alpha: options.alpha,
      confidenceLevel: options.confidenceLevel
    })

    // Bootstrap for confidence intervals
    const bootstrap = BootstrapResampling.bootstrap(
      treatment,
      (sample) => this.mean(sample) - this.mean(baseline),
      { iterations: options.bootstrapIterations }
    )

    // Power analysis
    const powerAnalysis = PowerAnalysis.calculatePower(
      abTest.effectSize.cohensD,
      treatment.length,
      options.alpha
    )

    // Sample size calculation
    const sampleSize = SampleSizeCalculator.forABTest(
      abTest.effectSize.cohensD,
      this.mean(baseline),
      0.8,
      options.alpha
    )

    // Multiple comparisons if provided
    let multipleComparisons: MultipleComparisonResult | undefined
    if (options.multipleComparisons && options.multipleComparisons.length > 0) {
      multipleComparisons = MultipleComparisons.benjaminiHochberg(
        options.multipleComparisons,
        options.alpha
      )
    }

    return {
      abTest,
      bootstrap,
      powerAnalysis,
      sampleSize,
      multipleComparisons
    }
  }

  private static mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }
}

// ============================================================================
// Export Utilities
// ============================================================================

export const StatisticalAnalysis = {
  ABTest: ABTesting,
  Bootstrap: BootstrapResampling,
  MultipleComparisons,
  PowerAnalysis,
  SampleSize: SampleSizeCalculator,
  VarianceReduction,
  FullSuite: StatisticalTestingSuite
}

// Export factory functions
export function createStatisticalAnalyzer() {
  return {
    abTest: (groupA: number[], groupB: number[], options?: any) =>
      ABTesting.test(groupA, groupB, options),
    bootstrap: (data: number[], statistic: (sample: number[]) => number, options?: any) =>
      BootstrapResampling.bootstrap(data, statistic, options),
    multipleComparisons: (pValues: Array<{ name: string; pValue: number }>, alpha?: number) =>
      MultipleComparisons.benjaminiHochberg(pValues, alpha),
    powerAnalysis: (effectSize: number, sampleSize: number, alpha?: number) =>
      PowerAnalysis.calculatePower(effectSize, sampleSize, alpha),
    sampleSize: (marginOfError: number, confidenceLevel?: number) =>
      SampleSizeCalculator.forProportion(marginOfError, confidenceLevel),
    fullAnalysis: (baseline: number[], treatment: number[], options?: any) =>
      StatisticalTestingSuite.runFullAnalysis(baseline, treatment, options)
  }
}