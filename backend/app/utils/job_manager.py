import asyncio
from collections import defaultdict


class JobProgress:
    def __init__(self):
        self._progress: dict[str, dict] = {}
        self._listeners: dict[str, list[asyncio.Queue]] = defaultdict(list)

    def update(self, job_id: str, stage: str, progress: float, **kwargs):
        event = {"stage": stage, "progress": progress, **kwargs}
        self._progress[job_id] = event
        for queue in self._listeners[job_id]:
            queue.put_nowait(event)

    def subscribe(self, job_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._listeners[job_id].append(queue)
        if job_id in self._progress:
            queue.put_nowait(self._progress[job_id])
        return queue

    def unsubscribe(self, job_id: str, queue: asyncio.Queue):
        if job_id in self._listeners:
            try:
                self._listeners[job_id].remove(queue)
            except ValueError:
                pass
            if not self._listeners[job_id]:
                del self._listeners[job_id]

    def cleanup(self, job_id: str):
        self._progress.pop(job_id, None)
        self._listeners.pop(job_id, None)


job_progress = JobProgress()
