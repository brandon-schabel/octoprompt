# Promptliano Userflow Guide

## Overview

Promptliano is a "human-in-the-loop" co-pilot tool designed to enhance AI-assisted software development. It acts as an intelligent context manager that helps developers provide the right information to AI coding assistants, ensuring more accurate and relevant code generation.

## The Ideal Workflow

### 1. Project Preparation

Before starting feature development, ensure your project is fully set up in Promptliano:

- **Import your project** into Promptliano
- **Run full project summarization** to analyze all files
  - This creates AI-readable summaries of your codebase
  - Enables intelligent file and prompt suggestions
- **Save domain-specific prompts** for technologies, patterns, or conventions used in your project

### 2. Feature Development Flow

When you're ready to build a new feature, follow this optimal workflow:

#### Step 1: Navigate to Project Context

- Go to the **Project Context** page in Promptliano
- This is your command center for gathering relevant context

#### Step 2: Describe Your Feature

- In the **User Input** section, write a detailed description of the feature you want to build
- Be specific about:
  - What the feature should do
  - How it should integrate with existing code
  - Any specific requirements or constraints
  - Technologies or patterns to use

#### Step 3: Find Relevant Files

- Click the **"Files"** button (search icon)
- Promptliano's AI analyzes your description and project context
- It suggests the most relevant files you'll need to reference or modify
- Review and select the files that are truly relevant to your task

#### Step 4: Get Prompt Suggestions

- Click the **"Prompts"** button (lightbulb icon)
- Based on your selected files and feature description, Promptliano suggests relevant saved prompts
- These might include:
  - Technology-specific guidelines (e.g., "React Component Best Practices")
  - Project conventions (e.g., "API Endpoint Patterns")
  - Domain knowledge (e.g., "Game Physics Implementation Guide")
- Select the prompts that will help guide the AI

#### Step 5: Copy Complete Context

- Click **"Copy All"** to copy:
  - Your detailed feature description
  - Selected file contents with summaries
  - Selected prompt contents
  - All formatted for optimal AI consumption
- The total token count is displayed to ensure you're within AI model limits

#### Step 6: Generate Code with AI

- Paste the context into your preferred AI assistant (Claude, GPT-4, etc.)
- The AI now has comprehensive understanding of:
  - What you want to build
  - Relevant existing code
  - Project-specific patterns and conventions
- Generate code that fits seamlessly into your project

## Advanced Usage: MCP Integration

Promptliano also supports the Model Context Protocol (MCP), allowing AI assistants to directly:

- Browse project files
- Search for relevant code
- Suggest files and prompts
- Access project context programmatically

This enables even more sophisticated AI-driven development workflows where the AI can autonomously gather the context it needs.

## Why This Workflow Works

### 1. **Comprehensive Context**

The AI receives all relevant information in one shot, reducing back-and-forth clarifications and improving first-attempt accuracy.

### 2. **Project-Specific Knowledge**

Saved prompts act as a "memory bank" for your project, ensuring the AI follows your specific conventions and patterns.

### 3. **Human Oversight**

You maintain control over what context is provided, ensuring the AI focuses on the right aspects of your codebase.

### 4. **Efficiency**

Instead of manually finding and copying relevant files, Promptliano's AI-powered suggestions save significant time.

### 5. **Consistency**

By using saved prompts for common patterns, you ensure consistent implementation across your entire project.

## Best Practices

1. **Keep Projects Summarized**: Re-summarize after significant changes to maintain accurate file suggestions
2. **Build a Prompt Library**: Save prompts for recurring patterns, technologies, and conventions
3. **Be Specific**: The more detailed your feature description, the better the file and prompt suggestions
4. **Review Suggestions**: Always review suggested files and prompts before copying
5. **Iterate**: If the AI's output isn't quite right, refine your input and try again

## Example Scenario

**Task**: Implement user authentication in a React/Node.js application

1. **User Input**: "Implement JWT-based authentication with login, logout, and protected routes. Need login form component, auth context, API endpoints for login/logout, and middleware for protecting routes."

2. **Suggested Files**:
   - `/src/contexts/AuthContext.tsx` (existing auth setup)
   - `/src/components/forms/FormInput.tsx` (reusable form component)
   - `/server/middleware/auth.js` (existing middleware patterns)
   - `/server/routes/users.js` (user route patterns)

3. **Suggested Prompts**:
   - "React Authentication Best Practices"
   - "JWT Token Security Guidelines"
   - "API Error Handling Patterns"

4. **Result**: The AI generates authentication code that perfectly matches your project's existing patterns and security requirements.

## Conclusion

Promptliano transforms AI-assisted development from a hit-or-miss experience into a reliable, efficient workflow. By providing comprehensive, relevant context, it enables AI to generate code that truly fits your project's needs.
