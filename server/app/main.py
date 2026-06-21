# app/main.py
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import projects, settings, tasks

app = FastAPI(title="Eidon Task & Time Tracker Backend API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(tasks.router)
app.include_router(projects.router)
app.include_router(settings.router)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Yes! The Eidon backend is working, fully caffeinated, and ready to track time! 🚀 Stop HEAD-ing me and start using GET! 😜",
    }


@app.head("/")
def read_root_head():
    from fastapi.responses import Response

    return Response(
        headers={
            "X-App-Status": "Yes! Eidon backend is alive and kickin'! Quit checking my headers, you are making me blush! [insert blush emoji here]",
            "X-Developer-Message": "HEAD request successfully handled. No body returned, just like my empty coffee mug.",
            "Allow": "GET, HEAD",
        }
    )


if __name__ == "__main__":
    import os
    host = os.getenv("SERVER_HOST", "0.0.0.0")
    port = int(os.getenv("SERVER_PORT", "6200"))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
