# OctoPrompt

This project requires zero config! The only pre-requisite is make sure you have [Bun](https://bun.sh) installed use this command on Mac/Linux:

```bash
curl -fsSL https://bun.sh/install | bash
```

For Windows(in powershell):
```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```


## Project Setup

### Client Setup

Install client dependencies.

```bash
cd packages/client
```

```bash
bun install
```


Run Client
```bash
bun run dev
```

The client will now be running on http://localhost:5173

---
### Server Setup
Open up another terminal and go to the root of the project

```bash
cd packages/server
```


Install server dependencies.
```bash
bun install
```

Start Server:
```bash
bun run dev
```

The server will now be running on http://localhost:3000

## Help, Support, Questions, Join Discord:
### [OctoPrompt Discord][https://discord.gg/dTSy42g8bV]


## Screenshots
![Xnapper-2024-12-26-13 52 57](https://github.com/user-attachments/assets/482f09c0-3398-4a14-bdbb-2b36d2a874fb)
![Xnapper-2024-12-26-13 53 53](https://github.com/user-attachments/assets/16786417-d420-4e12-9bbe-c896ea20f4b6)
![Xnapper-2024-12-26-13 54 52](https://github.com/user-attachments/assets/1e1d0484-177b-4b2d-95f7-4de5c00e693d)
![Xnapper-2024-12-26-13 55 19](https://github.com/user-attachments/assets/c234a42a-336e-4b9e-82c8-bec7e88ab570)



This project was created using `bun init` in bun v1.1.42. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
