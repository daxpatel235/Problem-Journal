export type Difficulty = "Easy" | "Medium" | "Hard";

export type SortOrder = "newest" | "oldest" | "name" | "updated";

export interface Problem {
  id: string;
  problemName: string;
  difficulty: string;
  topic: string;
  platform: string;
  url: string;
  problemStatement: string;
  examples: string[];
  patternCategory: string;
  favorite: boolean;
  bruteForce: string[];
  bruteForceTimeComplexity: string;
  bruteForceSpaceComplexity: string;
  pattern: string[];
  thinking: string[];
  timeComplexity: string;
  spaceComplexity: string;
  mistakes: string[];
  takeaways: string[];
  tags: string[];
  code: string;
  language: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemSummary {
  id: string;
  problemName: string;
  difficulty: string;
  topic: string;
  patternCategory: string;
  favorite: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProblemFormData {
  problemName: string;
  difficulty: string;
  topic: string;
  platform: string;
  url: string;
  problemStatement: string;
  examples: string[];
  patternCategory: string;
  favorite: boolean;
  bruteForce: string[];
  bruteForceTimeComplexity: string;
  bruteForceSpaceComplexity: string;
  pattern: string[];
  thinking: string[];
  timeComplexity: string;
  spaceComplexity: string;
  mistakes: string[];
  takeaways: string[];
  tags: string[];
  code: string;
  language: string;
}

export type CreateProblemInput = ProblemFormData;

export interface UpdateProblemInput extends ProblemFormData {
  id: string;
}

export interface ProblemFilters {
  query?: string;
  difficulty?: string;
  topic?: string;
  patternCategory?: string;
  tag?: string;
  favoritesOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sort?: SortOrder;
}

export const EMPTY_PROBLEM_FORM: ProblemFormData = {
  problemName: "",
  difficulty: "Medium",
  topic: "",
  platform: "",
  url: "",
  problemStatement: "",
  examples: [],
  patternCategory: "",
  favorite: false,
  bruteForce: [],
  bruteForceTimeComplexity: "",
  bruteForceSpaceComplexity: "",
  pattern: [],
  thinking: [],
  timeComplexity: "",
  spaceComplexity: "",
  mistakes: [],
  takeaways: [],
  tags: [],
  code: "",
  language: "python",
};
