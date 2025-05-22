from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
from datetime import datetime

# --- Agent Coder Schemas ---
# Last 5 changes:
# 1. Initial conversion from Zod to Pydantic.
# 2. Added placeholder for ProjectFile, Project, Prompt.
# 3. Used datetime for Zod's .datetime().
# 4. Mapped z.enum to Python Enum.
# 5. Mapped .openapi() descriptions/examples to Field attributes.

# Placeholder for schemas that would be imported from other files
# In a real scenario, these would be proper Pydantic models.
class ProjectFile(BaseModel):
    id: int
    project_id: Optional[str] = None
    # Add other fields as per actual ProjectFileSchema definition
    model_config = ConfigDict(title="ProjectFile", extra="allow")

class Project(BaseModel):
    id: int
    # Add other fields
    model_config = ConfigDict(title="Project", extra="allow")

class Prompt(BaseModel):
    id: int
    # Add other fields
    model_config = ConfigDict(title="Prompt", extra="allow")

# ProjectFileMapSchema is a map, so it can be represented as Dict[str, ProjectFile] or Dict[str, Any]
ProjectFileMap = Dict[str, ProjectFile]


class AgentTaskStatusEnum(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"

class AgentTask(BaseModel):
    id: int = Field(..., min_length=1, description="A unique ID automatically generated for tracking this specific task.", example="task-123-abc")
    title: str = Field(..., min_length=5, description="A brief, human-readable title summarizing the task's objective.", example="Refactor User Authentication Logic")
    description: str = Field(..., min_length=20, description="A detailed description of the changes required for the target file. This will be used as the primary instruction for the LLM rewrite.", example="Update the login function in `src/auth.ts` to use asynchronous hashing for passwords and return a JWT token upon successful authentication.")
    target_file_id: Optional[str] = Field(None, validation_alias="targetFileId", serialization_alias="targetFileId", description="The unique ID (from ProjectFileSchema) of the primary source file to be modified or created by this task. Will be populated by orchestrator for new files.", example="file-id-xyz-789")
    target_file_path: str = Field(..., min_length=1, validation_alias="targetFilePath", serialization_alias="targetFilePath", description="The relative path of the primary source file (e.g., 'src/utils/auth.ts'). Required for all tasks. Used for creation path.", example="src/utils/auth.ts")
    status: AgentTaskStatusEnum = Field(default=AgentTaskStatusEnum.PENDING, description="Tracks the progress of the task through the workflow.", example="PENDING")
    related_test_file_id: Optional[str] = Field(None, validation_alias="relatedTestFileId", serialization_alias="relatedTestFileId", description="Optional: The unique ID (from ProjectFileSchema) of the corresponding unit test file (e.g., 'src/utils/auth.test.ts'), if applicable.", example="file-id-test-abc-123")
    estimated_complexity: Optional[Literal["LOW", "MEDIUM", "HIGH"]] = Field(None, validation_alias="estimatedComplexity", serialization_alias="estimatedComplexity", description="Optional: AI's estimation of the task's complexity.", example="MEDIUM")
    dependencies: Optional[List[str]] = Field(None, description="Optional: A list of other Task IDs that must be completed before this task can start.", example=["task-001-xyz", "task-002-abc"])

    model_config = ConfigDict(title="AgentTask", populate_by_name=True, extra="allow")

class AgentFileRewriteResponse(BaseModel):
    updated_content: str = Field(..., validation_alias="updatedContent", serialization_alias="updatedContent", description="The complete, updated content of the file after applying the changes requested in the task description.", example="export function updatedFunction() { console.log('Updated!'); }")
    explanation: Optional[str] = Field(None, description="A brief explanation of the changes made (optional but helpful).", example="Refactored the function to use async/await and added error handling.")

    model_config = ConfigDict(title="AgentFileRewriteResponse", populate_by_name=True, extra="allow")


class AgentContext(BaseModel):
    user_input: str = Field(..., min_length=1, validation_alias="userInput", serialization_alias="userInput", description="The original user request.", example="Please implement JWT authentication.")
    project_files: List[ProjectFile] = Field(..., min_items=1, validation_alias="projectFiles", serialization_alias="projectFiles", description="Array of project files provided as context.")
    project_file_map: ProjectFileMap = Field(..., validation_alias="projectFileMap", serialization_alias="projectFileMap", description="Map representation of project files for quick lookup.")
    project_summary_context: str = Field(..., validation_alias="projectSummaryContext", serialization_alias="projectSummaryContext", description="A summary of the project's purpose and structure.", example="A Node.js backend service for managing user accounts.")
    project: Project
    agent_job_id: int = Field(..., validation_alias="agentJobId", serialization_alias="agentJobId", description="The ID of the agent job that is running this task plan.", example="job-xyz-789")
    prompts: List[Prompt] = Field(..., description="The prompts to use for the agent.")
    selected_file_ids: List[str] = Field(..., min_items=1, validation_alias="selectedFileIds", serialization_alias="selectedFileIds", description="Array of ProjectFile IDs to provide as initial context.", example=["file-id-1", "file-id-2"])

    model_config = ConfigDict(title="AgentContext", populate_by_name=True)


class AgentTaskPlan(BaseModel):
    project_id: int = Field(..., validation_alias="projectId", serialization_alias="projectId", description="The ID of the project context in which these tasks operate.", example="proj-abc-123")
    overall_goal: str = Field(..., validation_alias="overallGoal", serialization_alias="overallGoal", description="A concise summary of the original user request being addressed by this plan.", example="Implement JWT-based authentication flow.")
    tasks: List[AgentTask] = Field(..., min_items=1, description="An ordered list of tasks designed to collectively achieve the overall goal. Order implies execution sequence unless overridden by dependencies.")

    model_config = ConfigDict(title="AgentTaskPlan", populate_by_name=True, extra="allow")


class AgentCoderRunRequest(BaseModel):
    user_input: str = Field(..., min_length=1, validation_alias="userInput", serialization_alias="userInput", description="The main instruction or goal for the agent.", example="Refactor the authentication logic in auth.ts to use JWT.")
    selected_file_ids: List[str] = Field(..., min_items=1, validation_alias="selectedFileIds", serialization_alias="selectedFileIds", description="Array of ProjectFile IDs to provide as initial context.", example=["file-id-1", "file-id-2"])
    agent_job_id: Optional[str] = Field(None, validation_alias="agentJobId", serialization_alias="agentJobId", description="The unique ID for retrieving the execution logs and data for this run.")
    selected_prompt_ids: Optional[List[str]] = Field(None, validation_alias="selectedPromptIds", serialization_alias="selectedPromptIds", description="Array of Prompt IDs to provide as initial context.", example=["prompt-id-1", "prompt-id-2"])

    model_config = ConfigDict(title="AgentCoderRunRequest", populate_by_name=True)


class AgentCoderRunSuccessData(BaseModel):
    updated_files: List[ProjectFile] = Field(..., validation_alias="updatedFiles", serialization_alias="updatedFiles", description="The state of the project files after the agent's execution.")
    task_plan: Optional[AgentTaskPlan] = Field(None, validation_alias="taskPlan", serialization_alias="taskPlan", description="The final task plan executed by the agent (includes task statuses).")
    agent_job_id: int = Field(..., validation_alias="agentJobId", serialization_alias="agentJobId", description="The unique ID for retrieving the execution logs and data for this run.")

    model_config = ConfigDict(title="AgentCoderRunSuccessData", populate_by_name=True)


class AgentCoderRunResponse(BaseModel):
    success: Literal[True] = True
    data: AgentCoderRunSuccessData

    model_config = ConfigDict(title="AgentCoderRunResponse")


class AgentDataLogFinalStatusEnum(str, Enum):
    SUCCESS = "Success"
    FAILED = "Failed"
    NO_TASKS_GENERATED = "No tasks generated"
    ERROR = "Error"


class AgentDataLog(BaseModel):
    agent_job_dir_path: str = Field(..., validation_alias="agentJobDirPath", serialization_alias="agentJobDirPath", description="Absolute path to the directory containing logs for this job.")
    project_id: int = Field(..., validation_alias="projectId", serialization_alias="projectId", description="The ID of the project this agent run targeted.")
    agent_job_id: int = Field(..., validation_alias="agentJobId", serialization_alias="agentJobId", description="The unique ID for this agent run.")
    agent_job_start_time: datetime = Field(..., validation_alias="agentJobStartTime", serialization_alias="agentJobStartTime", description="ISO 8601 timestamp when the agent job started.")
    task_plan: Optional[AgentTaskPlan] = Field(None, validation_alias="taskPlan", serialization_alias="taskPlan", description="The initial task plan generated by the planning agent (before execution).")
    final_status: AgentDataLogFinalStatusEnum = Field(..., validation_alias="finalStatus", serialization_alias="finalStatus", description="The final outcome status of the agent run.")
    final_task_plan: Optional[AgentTaskPlan] = Field(None, validation_alias="finalTaskPlan", serialization_alias="finalTaskPlan", description="The task plan reflecting the state after execution attempts (tasks will have final statuses like COMPLETED, FAILED).")
    agent_job_end_time: datetime = Field(..., validation_alias="agentJobEndTime", serialization_alias="agentJobEndTime", description="ISO 8601 timestamp when the agent job finished or errored.")
    error_message: Optional[str] = Field(None, validation_alias="errorMessage", serialization_alias="errorMessage", description="Error message if the agent run failed.")
    error_stack: Optional[str] = Field(None, validation_alias="errorStack", serialization_alias="errorStack", description="Stack trace if the agent run failed.")
    updated_files: Optional[List[ProjectFile]] = Field(None, validation_alias="updatedFiles", serialization_alias="updatedFiles", description="List of files with proposed changes (new files or modified files with different checksums).")

    model_config = ConfigDict(title="AgentDataLog", populate_by_name=True, extra="allow")
