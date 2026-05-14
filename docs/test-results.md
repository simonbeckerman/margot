# Test results

**1. Resolves UK tax year 2026**  
We checked the UK tax year 2026 date span. The span runs from 6 April 2026 to 5 April 2027.

**2. Seed country before any trip**  
We checked which country applied before any trip was stored. The answer is the default starting country in the spec.

**3. Arrival country after a trip**  
We checked which country applied on each day after a simple UK to France trip. The UK applies before the arrival day, and France from the arrival day onward.

**4. UK single trip out: departure day and seed**  
We checked UK day totals around a one-way leave from the UK, including the day of departure. The wider window shows two UK days, and 1 June alone shows zero UK days when that was the leave day.

**5. UK arrival on the day counts**  
We checked one calendar day in the UK on the day of arrival from France. That day scores one UK day.

**6. Non-UK inclusive presence in France**  
We checked day totals in France for a short range using the non-UK rule. The result is three days in the asked window.

**7. Same calendar day: UK to Israel**  
We logged one leg that left the UK and arrived in Israel on the same date. That date scores zero UK days and one Israel day.

**8. Israel two-day leg**  
We logged a UK to Israel leg with different depart and arrive dates. The UK depart date scores zero UK days; the Israel arrival date scores one Israel day.

**9. Italy: arrival day and case-insensitive country**  
We asked for Italy on the arrival date only, using a lower-case country string. We get one inclusive day and the correct method.

**10. UK range before any trips**  
We checked a UK day range in January with no trip rows on file. All five days count as the UK from the default starting point.

**11. Same-day depart and arrive in the same country**  
We used a same-day internal France to France move and asked for a count. The run completes without an error.

**12. UK boundary around tax year end**  
We checked UK day totals across the turn of a tax year for a long trip. The UK part in the small window is one day.

**13. Multiple trips in one calendar year**  
We looked at a full calendar year with two cross-border trips, for both France and the UK. France shows a smaller total; the UK shows a much larger total and the correct rule label.

**14. Chiara trips do not affect Simon counts**  
We counted for Simon in the UK while a trip stored only for Chiara was in the file. Simon’s result matches six UK days in that window and is not changed by Chiara’s trip.

**15. Smoke: no private code**  
We called the online helper with no private code. The service refused, which is the safe outcome.

**16. Smoke: optional live log trip**  
We optionally sent a 2030 test trip with Simon’s private code, when that code is set. The call succeeds, or the step is skipped with a short note if no code is set.

**17. End-to-end: rotate companion codes**  
We created new private codes for Simon and Chiara and installed them. The new codes are printed: save them, because the old ones stop working.

**18. End-to-end: Simon logs UK to France (2030)**  
We used Simon’s new code to store a dummy 2030 trip from the UK to France. A new trip id is returned and there is no error.

**19. End-to-end: Simon logs Chiara’s return**  
We used Simon’s new code to store Chiara’s return trip. A new trip id is returned and the row shows who filed it.

**20. End-to-end: Simon UK days in 2030**  
We asked the helper for Simon’s UK day total in 2030. A full answer is returned and there is no error.

**21. End-to-end: Chiara France days in 2030**  
We asked the helper for Chiara’s days in France in 2030 as a calendar year. A full answer is returned and there is no error.

**22. End-to-end: delete dummy test rows**  
We removed every row whose notes look like a dummy end-to-end test. The clean-up command runs.

**23. End-to-end: verify no dummy rows left**  
We counted any rows that still had dummy end-to-end notes. The count should be zero when the run is healthy.

**24. Past-only window: no future days projected**  
We asked for UK days in a window that ended before today. The count is the full window and zero days are reported as still to come.

**25. Window that crosses today: count stops at today**  
We asked for UK days in a window that started before today and ended after today. The count goes up to today only and the days from tomorrow to the end of the window are reported as still to come.

**26. Window entirely in the future: nothing counted yet**  
We asked for UK days in a window that starts after today. The count is zero, the displayed end date collapses to the start date, and every day in the window is reported as still to come.

**27. Current UK tax year: count stops at today, not 5 April**  
We asked for UK days in the current UK tax year (today inside the window). The count covers 6 April up to today only, and the days from tomorrow through 5 April next year are reported as still to come.

**28. Window that ends exactly today: behaves as a past window**  
We asked for UK days in a window whose last day is today. The count covers the full window and zero days are reported as still to come.

**29. log_trip: preview before insert**  
We asked Claude to log a test trip (UK to Italy, 1-5 July 2026). The tool returned a preview with all fields normalized and asked for confirmation before inserting anything.

**30. log_trip: insert on confirm**  
We confirmed the preview. The trip was inserted and Claude reported the result. The row appeared in the database.

**31. edit_trip: preview shows diff before saving**  
We asked Claude to change the arrival date on the test trip to 7 July 2026. The tool returned a diff (arrive_date: 5 July → 7 July) and asked for confirmation before writing.

**32. edit_trip: update on confirm**  
We confirmed the edit. The trip was updated and Claude reported the new values alongside the original ones.

**33. delete_trip: preview before delete**  
We asked Claude to delete the test trip. The tool returned the full trip details and asked for confirmation before touching anything.

**34. delete_trip: moves row to deleted_trips on confirm**  
We confirmed the deletion. The row was removed from trips and appeared in deleted_trips. Database confirmed: 0 rows in trips, 1 in deleted_trips with notes "test".

**35. restore_trip: recovers deleted row**  
We asked Claude to restore the deleted trip. The row was moved back to trips with its original id and dates intact. No confirm step required.

**36. Full cleanup: delete restored trip**  
We deleted the restored test trip and confirmed. trips shows 0 test rows; deleted_trips retains the archive row.
