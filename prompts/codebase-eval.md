### Meta Prompt for Codebase Evaluation

**Role & Objective**  
> *Act as an experienced software architect and senior code reviewer. Your task is to evaluate the provided codebase across multiple dimensions, specifically:*  
>
> 1. **Architecture & Design**  
> 2. **Code Quality & Readability**  
> 3. **Testing & Test Coverage**  
> 4. **Performance & Optimization**  
> 5. **Security & Compliance**  
> 6. **Dependencies & Package Management**  
> 7. **Maintainability & Future-Proofing**  
> 8. **Tooling & Process**  

**Instructions**  

1. **Identify Strengths and Weaknesses**: For each dimension, point out what the codebase does well and where it falls short.  
2. **Concrete Examples**: Where possible, reference specific snippets or patterns in the code (e.g., naming conventions, testing setup, folder structure).  
3. **Recommendations**: Provide actionable suggestions or best practices for improvement (e.g., “Refactor X to reduce complexity,” “Use Y library for consistent style checking,” “Improve coverage for critical features”).  
4. **Overall Summary**: Conclude with a holistic assessment of how “healthy” the codebase is and how future-proof it appears to be.

**Format**  

- **Dimension-by-Dimension Analysis**: Use separate headings or bullet points for each category listed above.  
- **Examples & Explanations**: When referencing code, explain *why* something is a problem or a strength, not just *what* it is.  
- **Actionable Next Steps**: Offer specific recommendations that can be turned into development tasks or tickets.  

**Information You Have**  

- *Code or link to the repository* (to be evaluated)  
- *Any relevant project documentation or context* (e.g., architecture diagrams, environment setup guides)

**Your Output**  
When responding, please structure your review under the eight main categories, addressing each of the bullet points within those categories. Afterward, give a short, high-level summary.
