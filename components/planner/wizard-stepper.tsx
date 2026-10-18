"use client"

import React from "react"
import { usePlanner, type WizardStepId } from "./planner-context"
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Plane,
  Building,
  Car,
  Compass,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { cn } from "cn"

function StepIconRenderer({
  id,
  className,
}: {
  id: WizardStepId
  className?: string
}) {
  switch (id) {
    case "setup":
      return <Calendar className={className} />
    case "flights":
      return <Plane className={className} />
    case "hotels":
      return <Building className={className} />
    case "transport":
      return <Car className={className} />
    case "ziyarat":
      return <Compass className={className} />
    case "review":
      return <ShieldCheck className={className} />
  }
}

export function WizardStepperHeader() {
  const { wizardSteps, currentStepIndex, activeStep, goToStep } = usePlanner()

  const totalSteps = wizardSteps.length
  const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100)

  const stepGridClass =
    totalSteps === 6
      ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
      : totalSteps === 5
      ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      : totalSteps === 4
      ? "grid grid-cols-2 sm:grid-cols-4"
      : totalSteps === 3
      ? "grid grid-cols-3"
      : totalSteps === 2
      ? "grid grid-cols-2"
      : "flex flex-wrap items-center"

  return (
    <div className="w-full rounded-2xl border border-[#E6DEC8] bg-white p-4 sm:p-5 shadow-xs mb-6">
      {/* Top Progress Info */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F0] border border-[#C5A059]/60 px-3 py-1 text-[11px] font-bold text-[#8F6E2A]">
            <Sparkles className="size-3 text-[#C5A059]" />
            <span>
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
          </span>
          <span className="text-xs font-semibold text-[#1A1D1A] hidden sm:inline">
            {activeStep.title}
          </span>
        </div>

        <span className="font-mono text-xs font-bold text-[#0A3622]">
          {progressPercent}% Complete
        </span>
      </div>

      {/* Progress Bar Track */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#E6DEC8]/50 border border-[#E6DEC8]/40">
        <div
          className="h-full bg-gradient-to-r from-[#0A3622] via-[#0F4C31] to-[#C5A059] transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Clickable Step Pills / Tabs */}
      <div className={cn("mt-4 gap-1.5 sm:gap-2 pt-0.5", stepGridClass)}>
        {wizardSteps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex
          const isActive = idx === currentStepIndex
          const isUpcoming = idx > currentStepIndex

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => goToStep(step.id)}
              className={cn(
                "group flex w-full items-center justify-center gap-1 sm:gap-1.5 rounded-full px-1.5 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#C5A059]/50",
                isActive &&
                  "bg-[#0A3622] text-white shadow-xs border border-[#C5A059]",
                isCompleted &&
                  "bg-[#0A3622]/10 text-[#0A3622] border border-[#0A3622]/20 hover:bg-[#0A3622]/15",
                isUpcoming &&
                  "bg-[#FAF7F0] text-[#686E65] border border-[#E6DEC8] hover:border-[#C5A059]/60 hover:text-[#1A1D1A]"
              )}
            >
              {isCompleted ? (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#0A3622] text-white">
                  <Check className="size-2.5 stroke-[3]" />
                </span>
              ) : (
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isActive
                      ? "bg-[#C5A059] text-[#0A3622]"
                      : "bg-[#E6DEC8] text-[#686E65]"
                  )}
                >
                  {step.stepNumber}
                </span>
              )}

              <StepIconRenderer
                id={step.id}
                className="size-3.5 shrink-0 opacity-80"
              />
              <span className="whitespace-nowrap tracking-tight">{step.shortTitle}</span>
            </button>
          )
        })}
      </div>

      {/* Active Step Banner */}
      <div className="mt-4 pt-4 border-t border-[#E6DEC8]/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FAF7F0] border border-[#C5A059]/40 text-[#0A3622] shadow-xs">
            <StepIconRenderer
              id={activeStep.id}
              className="size-5 text-[#8F6E2A]"
            />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#0A3622]">
              {activeStep.title}
            </h3>
            <p className="text-xs text-[#686E65] leading-snug">
              {activeStep.subtitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WizardBottomNav() {
  const {
    wizardSteps,
    currentStepIndex,
    activeStep,
    goToPrevStep,
    goToNextStep,
  } = usePlanner()

  const totalSteps = wizardSteps.length
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === totalSteps - 1

  const prevStep = isFirstStep ? null : wizardSteps[currentStepIndex - 1]
  const nextStep = isLastStep ? null : wizardSteps[currentStepIndex + 1]

  return (
    <div className="w-full rounded-2xl border border-[#E6DEC8] bg-[#FAF7F0] p-4 sm:p-5 shadow-xs mt-2">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Previous Button */}
        <div>
          {!isFirstStep && prevStep ? (
            <button
              type="button"
              onClick={goToPrevStep}
              className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-[#E6DEC8] bg-white px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#1A1D1A] shadow-xs hover:bg-[#FAF7F0] hover:border-[#C5A059] transition-all focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
            >
              <ArrowLeft className="size-4 text-[#8F6E2A]" />
              <span className="hidden sm:inline">Previous:</span>
              <span>{prevStep.shortTitle}</span>
            </button>
          ) : (
            <div className="text-[11px] text-[#686E65] font-medium italic pl-1 hidden sm:block">
              Step 1 • Initial Setup
            </div>
          )}
        </div>

        {/* Center: Step Indicator */}
        <div className="text-center">
          <span className="text-xs font-semibold text-[#8F6E2A]">
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
          <p className="text-[11px] text-[#686E65] hidden md:block">
            {activeStep.shortTitle}
          </p>
        </div>

        {/* Right: Next Step / Action */}
        <div>
          {!isLastStep && nextStep ? (
            <button
              type="button"
              onClick={goToNextStep}
              className="group flex items-center gap-2 rounded-xl bg-[#0A3622] px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#0A3622]/20 hover:bg-[#0F4C31] hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
            >
              <span>Continue to {nextStep.shortTitle}</span>
              <ArrowRight className="size-4 text-[#C5A059] transition-transform group-hover:translate-x-1" />
            </button>
          ) : (
            <a
              href="#lead-contact-form"
              className="flex items-center gap-1.5 rounded-xl border border-[#C5A059]/60 bg-white px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold text-[#0A3622] shadow-xs hover:bg-[#FAF7F0] transition-colors"
            >
              <Sparkles className="size-3.5 text-[#C5A059]" />
              <span>Fill Details Below</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
