## **README Generation Meta-Prompt**

You are an **advanced technical writer** and a **TypeScript + Bun expert**. Your task is to write a comprehensive README for an open-source TypeScript library, following these guidelines:

1. **Project Context**  
   - The library is relatively small in scope but **highly focused**, **pluggable**, and **well-tested**.  
   - It **relies on Bun** and **minimizes external dependencies** wherever possible.  
   - **Type safety** and **performance** are priorities.

2. **Structure & Tone**  
   - Present the README in a **clear, organized, and professional** manner.  
   - Use **concise language**.  
   - Provide a **table of contents** if the document is long.  
   - Use **headings**, **subheadings**, and **code blocks** appropriately.

3. **Sections to Include**  
   1. **Introduction**  
      - Clearly state the library’s **purpose** and **key features**:  
        - Type safety  
        - Performance  
        - Plug-and-play modularity  
        - Zero or minimal external dependencies  

   2. **Installation**  
      - Demonstrate how to install the library using **Bun** (and optionally npm or yarn, if relevant).  
      - Example:
        ```bash
        bun add my-library
        ```

   3. **Usage Examples**  
      - Show at least one **simple example** to get started.  
      - Provide **more advanced scenarios** demonstrating pluggability or complex use cases.  
      - Ensure **TypeScript code snippets** are fully expanded—no truncation.  

   4. **API Documentation**  
      - If applicable, outline any main **functions**, **classes**, or **types**.  
      - Include **parameter and return types** with brief descriptions.  
      - Emphasize advanced TS features (e.g., generics, mapped types, etc.) if relevant.

   5. **Performance Notes**  
      - Highlight any **Bun-specific optimizations** or performance tips.  
      - Mention how/why the library avoids heavy dependencies.

   6. **Configuration & Customization**  
      - Show how to **configure** or **plug in** additional functionality.  
      - Encourage a modular design approach (e.g., passing config as objects).

   7. **Testing**  
      - Provide instructions or examples on how to **test** the library using Bun’s built-in test suite.  
      - Emphasize the library’s **testability** and any relevant testing patterns.

   8. **Contributing**  
      - Offer guidance for potential contributors, covering code style, branching, or testing guidelines.

   9. **License**  
      - State the **license** clearly.

4. **Style & Formatting**  
   - Make sure **code blocks** are correct and fully expanded.  
   - Do not abbreviate or shorten code snippets.  
   - Use modern **TypeScript** in examples (e.g., arrow functions, async/await, generics).

5. **Output Requirements**  
   - **Output only** the README text (no additional commentary unless it’s part of the README content).  
   - Ensure the README is logically coherent and **immediately usable** in a GitHub repository.

6. **Additional Prompting** (Optional)  
   - If there’s a **more optimal approach** to explaining a feature or structuring the README, implement it and briefly mention why it’s superior.

  
### **Final Request to the Model:**

- “Using all the guidelines above, **generate the complete README** for the provided code or library. 
- Write with the assumption that the user will be working with **Bun** primarily. 
- Keep it succinct, yet thorough, with ample **TypeScript examples**. 
- Ensure test instructions reference **Bun’s test suite**.”
