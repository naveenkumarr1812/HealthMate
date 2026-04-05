"""
Free location-based search using DuckDuckGo + OpenStreetMap Nominatim.
No API key required. Gives real hospital/doctor results near GPS coordinates.
"""
import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/search", tags=["Location Search"])

async def search_nearby_places(query: str, lat: float, lng: float, radius_km: int = 10) -> list:
    """
    Uses OpenStreetMap Overpass API (100% free) to find real hospitals/clinics near coordinates.
    """
    # Overpass API query for medical facilities
    overpass_query = f"""
[out:json][timeout:25];
(
  node["amenity"="hospital"](around:{radius_km*1000},{lat},{lng});
  node["amenity"="clinic"](around:{radius_km*1000},{lat},{lng});
  node["amenity"="doctors"](around:{radius_km*1000},{lat},{lng});
  node["amenity"="pharmacy"](around:{radius_km*1000},{lat},{lng});
  way["amenity"="hospital"](around:{radius_km*1000},{lat},{lng});
  way["amenity"="clinic"](around:{radius_km*1000},{lat},{lng});
);
out body center 15;
"""
    results = []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": overpass_query},
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
        if res.status_code == 200:
            data = res.json()
            elements = data.get("elements", [])
            for el in elements[:15]:
                tags = el.get("tags", {})
                name = tags.get("name") or tags.get("name:en")
                if not name:
                    continue
                # Get coordinates
                if el.get("type") == "node":
                    el_lat, el_lng = el.get("lat"), el.get("lon")
                else:
                    el_lat = el.get("center", {}).get("lat")
                    el_lng = el.get("center", {}).get("lon")

                if not el_lat or not el_lng:
                    continue

                # Calculate rough distance
                dist_km = round(((lat - el_lat)**2 + (lng - el_lng)**2)**0.5 * 111, 1)

                results.append({
                    "name":      name,
                    "type":      tags.get("amenity", "medical").replace("_", " ").title(),
                    "address":   tags.get("addr:full") or tags.get("addr:street", ""),
                    "phone":     tags.get("phone") or tags.get("contact:phone", ""),
                    "website":   tags.get("website") or tags.get("contact:website", ""),
                    "emergency": tags.get("emergency", ""),
                    "lat":       el_lat,
                    "lng":       el_lng,
                    "dist_km":   dist_km,
                    "maps_url":  f"https://www.google.com/maps/search/?api=1&query={el_lat},{el_lng}",
                })
            # Sort by distance
            results.sort(key=lambda x: x["dist_km"])
    except Exception as e:
        print(f"[OSM Search] Error: {e}")

    return results


async def duckduckgo_medical_search(query: str) -> list[str]:
    """
    Free web search via DuckDuckGo for medical information.
    No API key needed.
    """
    results = []
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            res = await client.get(
                "https://api.duckduckgo.com/",
                params={
                    "q":      query,
                    "format": "json",
                    "no_redirect": "1",
                    "no_html": "1",
                    "skip_disambig": "1",
                },
                headers={"User-Agent": "MedAI/1.0"}
            )
        if res.status_code == 200:
            data = res.json()
            # Abstract
            if data.get("AbstractText"):
                results.append(data["AbstractText"])
            # Related topics
            for topic in data.get("RelatedTopics", [])[:5]:
                if isinstance(topic, dict) and topic.get("Text"):
                    results.append(topic["Text"])
    except Exception as e:
        print(f"[DDG] Error: {e}")
    return results


@router.get("/nearby")
async def nearby_medical(lat: float, lng: float, type: str = "hospital"):
    """Returns real nearby medical facilities using OpenStreetMap."""
    results = await search_nearby_places(type, lat, lng)
    return {"results": results, "count": len(results)}
