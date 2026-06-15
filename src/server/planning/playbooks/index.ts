// Registry of codified expert playbooks, keyed by milestone domain.

import { Playbook } from "./types";
import { languageExamPlaybook } from "./language-exam";
import { fitnessPlaybook } from "./fitness";

const PLAYBOOKS: Playbook[] = [languageExamPlaybook, fitnessPlaybook];

export function getPlaybookForDomain(domain: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.domain === domain);
}

export function getPlaybookByKey(key: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.key === key);
}

export function allPlaybooks(): Playbook[] {
  return PLAYBOOKS;
}

export type { Playbook } from "./types";
