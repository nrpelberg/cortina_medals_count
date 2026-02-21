"""
2026 Winter Olympics Medal Table Scraper
Fetches data from Wikipedia and outputs a formatted medal count table.
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime


def scrape_medal_table(url: str = "https://en.wikipedia.org/wiki/2026_Winter_Olympics_medal_table") -> pd.DataFrame:
    """
    Scrapes the 2026 Winter Olympics medal table from Wikipedia.
    Returns a pandas DataFrame with columns: Rank, Country, Gold, Silver, Bronze, Total
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; OlympicsMedalScraper/1.0)"
    }

    print(f"Fetching data from: {url}")
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Wikipedia medal tables have a wikitable class, often with 'sortable'
    medal_table = None
    for table in soup.find_all("table", class_="wikitable"):
        headers_row = table.find("tr")
        if headers_row:
            header_text = headers_row.get_text().lower()
            # Look for a table that has gold/silver/bronze columns
            if "gold" in header_text and "silver" in header_text and "bronze" in header_text:
                medal_table = table
                break

    if medal_table is None:
        raise ValueError("Could not find a medal table on the page. The page structure may have changed.")

    rows = []
    for tr in medal_table.find_all("tr")[1:]:  # Skip header row
        cols = tr.find_all(["td", "th"])
        if len(cols) < 5:
            continue

        # Extract text, stripping footnotes and whitespace
        def clean(cell):
            return cell.get_text(strip=True).replace("\xa0", " ").split("[")[0].strip()

        rank    = clean(cols[0])
        country = clean(cols[1])
        gold    = clean(cols[2])
        silver  = clean(cols[3])
        bronze  = clean(cols[4])
        total   = clean(cols[5]) if len(cols) > 5 else ""

        # Skip rows that are totals/summary rows (often marked with * or "Total")
        if "total" in country.lower() or "total" in rank.lower():
            continue

        # Skip empty rows
        if not country:
            continue

        rows.append({
            "Rank":    rank,
            "Country": country,
            "Gold":    int(gold)   if gold.isdigit()   else 0,
            "Silver":  int(silver) if silver.isdigit() else 0,
            "Bronze":  int(bronze) if bronze.isdigit() else 0,
            "Total":   int(total)  if total.isdigit()  else 0,
        })

    df = pd.DataFrame(rows)
    return df


def display_table(df: pd.DataFrame) -> None:
    """Prints a nicely formatted medal table to the console."""
    print("\n" + "=" * 60)
    print(f"  2026 WINTER OLYMPICS MEDAL TABLE")
    print(f"  Scraped: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print(f"{'Rank':<6} {'Country':<30} {'🥇 Gold':<10} {'🥈 Silver':<10} {'🥉 Bronze':<10} {'Total':<6}")
    print("-" * 60)

    for _, row in df.iterrows():
        print(
            f"{str(row['Rank']):<6} "
            f"{row['Country']:<30} "
            f"{str(row['Gold']):<10} "
            f"{str(row['Silver']):<10} "
            f"{str(row['Bronze']):<10} "
            f"{str(row['Total']):<6}"
        )

    print("=" * 60)
    print(f"  Total countries: {len(df)}")
    print(f"  Total medals:    {df['Total'].sum()}")
    print("=" * 60)


def save_to_csv(df: pd.DataFrame, filename: str = "medal_table.csv") -> None:
    """Saves the DataFrame to a CSV file."""
    df.to_csv(filename, index=False)
    print(f"\nData saved to: {filename}")


if __name__ == "__main__":
    # Scrape the medal table
    df = scrape_medal_table()

    # Display in terminal
    display_table(df)

    # Save to CSV
    save_to_csv(df)

    # Optional: show top 5
    print("\nTop 5 countries by gold medals:")
    print(df.head(5).to_string(index=False))
