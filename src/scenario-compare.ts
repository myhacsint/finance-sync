import type { NamedScenario } from "./named-scenarios.js";

export interface ScenarioCompare {
  left: { id: string; name: string; fireTargetAge: number; monthlyChangeMinor: number };
  right: { id: string; name: string; fireTargetAge: number; monthlyChangeMinor: number };
  delta: { fireTargetAge: number; monthlyChangeMinor: number };
}

export function compareNamedScenarios(left: NamedScenario, right: NamedScenario): ScenarioCompare {
  return {
    left: {
      id: left.id,
      name: left.name,
      fireTargetAge: left.inputs.fireTargetAge,
      monthlyChangeMinor: left.inputs.monthlyChangeMinor
    },
    right: {
      id: right.id,
      name: right.name,
      fireTargetAge: right.inputs.fireTargetAge,
      monthlyChangeMinor: right.inputs.monthlyChangeMinor
    },
    delta: {
      fireTargetAge: right.inputs.fireTargetAge - left.inputs.fireTargetAge,
      monthlyChangeMinor: right.inputs.monthlyChangeMinor - left.inputs.monthlyChangeMinor
    }
  };
}
